import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import { type Scalar } from '@op-engineering/op-sqlite';
import { LFMEmbeddings } from './lfmEmbeddings';
import { type ContextChunk, sourceKey } from './contextUtils';
import {
  ATTACHMENT_RELEVANCE_BONUS,
  CANDIDATE_POOL,
  MAX_CHUNKS_PER_FILE,
  MAX_RELEVANT_CHUNKS,
  STRONG_SEMANTIC_THRESHOLD,
} from '../constants/retrieval';

type Candidate = {
  id: string;
  document?: string;
  embedding: number[];
  documentId?: number;
  name?: string;
  similarity: number;
};

type HydratedRow = Omit<Candidate, 'similarity'>;

const resolveName = (
  name: string | undefined,
  documentId: number | undefined,
  sourceNamesById: Map<number, string>
): string | undefined =>
  name ||
  (typeof documentId === 'number'
    ? sourceNamesById.get(documentId)
    : undefined);

const hydrateChunksByIds = async (
  vectorStore: OPSQLiteVectorStore,
  ids: string[]
): Promise<HydratedRow[]> => {
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => '?').join(', ');
  const result = await vectorStore.db.execute(
    `SELECT id, document, embedding, metadata FROM vectors WHERE id IN (${placeholders})`,
    ids
  );

  return result.rows.map((row: Record<string, Scalar>) => {
    const metadata = row.metadata
      ? JSON.parse(row.metadata as string)
      : undefined;
    return {
      id: String(row.id),
      document: (row.document as string | null) ?? undefined,
      embedding: Array.from(new Float32Array(row.embedding as ArrayBuffer)),
      documentId: metadata?.documentId,
      name: metadata?.name,
    };
  });
};

const parseChunkId = (
  id: string
): { documentId: number; chunkIndex: number } | null => {
  const match = /^(\d+):(\d+)$/.exec(id);
  return match
    ? { documentId: Number(match[1]), chunkIndex: Number(match[2]) }
    : null;
};

const NEIGHBOR_RADIUS = 1;

const expandSelectedWithNeighbors = async (
  selectedIds: string[],
  byId: Map<string, Candidate>,
  vectorStore: OPSQLiteVectorStore,
  sourceNamesById: Map<number, string>
): Promise<ContextChunk[]> => {
  type Group = {
    documentId?: number;
    name?: string;
    indices: Map<string, number>;
  };
  const groupOrder: string[] = [];
  const groups = new Map<string, Group>();
  const selectedSimilarity = new Map<string, number>();

  for (const id of selectedIds) {
    const candidate = byId.get(id);
    if (!candidate) continue;
    selectedSimilarity.set(id, candidate.similarity);

    const key = sourceKey(candidate.documentId, candidate.name ?? '');
    let group = groups.get(key);
    if (!group) {
      group = {
        documentId: candidate.documentId,
        name: candidate.name,
        indices: new Map(),
      };
      groups.set(key, group);
      groupOrder.push(key);
    }

    const parsed = parseChunkId(id);
    group.indices.set(id, parsed ? parsed.chunkIndex : -1);
    if (!parsed) continue;

    for (let offset = -NEIGHBOR_RADIUS; offset <= NEIGHBOR_RADIUS; offset++) {
      if (offset === 0) continue;
      const neighborIndex = parsed.chunkIndex + offset;
      if (neighborIndex < 0) continue;
      const neighborId = `${parsed.documentId}:${neighborIndex}`;
      if (!group.indices.has(neighborId)) {
        group.indices.set(neighborId, neighborIndex);
      }
    }
  }

  const allIds = groupOrder.flatMap((key) => [
    ...groups.get(key)!.indices.keys(),
  ]);
  const fetched = await hydrateChunksByIds(
    vectorStore,
    allIds.filter((id) => !byId.has(id))
  );

  const chunkById = new Map<string, HydratedRow>();
  for (const id of allIds) {
    const candidate = byId.get(id);
    if (candidate) {
      chunkById.set(id, {
        id,
        document: candidate.document,
        embedding: candidate.embedding,
        documentId: candidate.documentId,
        name: candidate.name,
      });
    }
  }
  for (const row of fetched) {
    chunkById.set(row.id, {
      ...row,
      name: resolveName(row.name, row.documentId, sourceNamesById),
    });
  }

  const result: ContextChunk[] = [];
  for (const key of groupOrder) {
    const group = groups.get(key)!;

    const seeds = [...group.indices.entries()]
      .filter(([id]) => selectedSimilarity.has(id))
      .sort(
        (a, b) =>
          (selectedSimilarity.get(b[0]) ?? 0) -
            (selectedSimilarity.get(a[0]) ?? 0) || a[1] - b[1]
      );

    const emitted = new Set<string>();
    const orderedIds: string[] = [];
    for (const [seedId, seedIndex] of seeds) {
      const parsed = parseChunkId(seedId);
      const documentId = parsed?.documentId ?? group.documentId;
      const windowIds = (
        parsed
          ? [seedIndex - 1, seedIndex, seedIndex + 1].map(
              (idx) => `${documentId}:${idx}`
            )
          : [seedId]
      ).filter((id) => group.indices.has(id));
      for (const id of windowIds) {
        if (emitted.has(id) || !chunkById.get(id)?.document) continue;
        emitted.add(id);
        orderedIds.push(id);
      }
    }

    for (const id of orderedIds) {
      const info = chunkById.get(id)!;
      result.push({
        document: info.document,
        similarity: selectedSimilarity.get(id) ?? 0,
        metadata: {
          documentId: info.documentId ?? group.documentId,
          name: info.name ?? group.name,
        },
      });
    }
  }

  return result;
};

export type RetrieveParams = {
  prompt: string;
  enabledSourceIds: number[];
  vectorStore: OPSQLiteVectorStore;
  sourceNamesById: Map<number, string>;
  embeddings?: LFMEmbeddings | null;
  attachmentSourceIds?: number[];
};

export const retrieve = async ({
  prompt,
  enabledSourceIds,
  vectorStore,
  sourceNamesById,
  embeddings,
  attachmentSourceIds = [],
}: RetrieveParams): Promise<ContextChunk[]> => {
  const attachmentSet = new Set(attachmentSourceIds);
  const enabledSet = new Set(enabledSourceIds);
  const isAttachment = (documentId?: number): boolean =>
    typeof documentId === 'number' && attachmentSet.has(documentId);

  let queryEmbedding: number[] | undefined;
  if (embeddings) {
    try {
      queryEmbedding = await embeddings.embedQuery(prompt);
    } catch (error) {
      console.warn('Query embedding failed; using text-query fallback', error);
    }
  }

  const vectorResults = await vectorStore
    .query({
      ...(queryEmbedding ? { queryEmbedding } : { queryText: prompt }),
      predicate: (r) => enabledSet.has(r.metadata?.documentId),
      nResults: CANDIDATE_POOL,
    })
    .catch((error) => {
      console.warn('Vector query failed; returning no chunks', error);
      return [] as Awaited<ReturnType<typeof vectorStore.query>>;
    });

  const byId = new Map<string, Candidate>();
  for (const result of vectorResults) {
    byId.set(result.id, {
      id: result.id,
      document: result.document,
      embedding: result.embedding,
      documentId: result.metadata?.documentId,
      name: resolveName(
        result.metadata?.name,
        result.metadata?.documentId,
        sourceNamesById
      ),
      similarity: result.similarity,
    });
  }

  const qualified = [...byId.values()].filter(
    (candidate) =>
      isAttachment(candidate.documentId) ||
      candidate.similarity >= STRONG_SEMANTIC_THRESHOLD
  );

  if (qualified.length === 0) return [];

  const scored = qualified
    .map((candidate) => ({
      id: candidate.id,
      documentId: candidate.documentId,
      relevance:
        candidate.similarity +
        (isAttachment(candidate.documentId) ? ATTACHMENT_RELEVANCE_BONUS : 0),
    }))
    .sort((a, b) => b.relevance - a.relevance);

  const distinctDocs = new Set(qualified.map((c) => c.documentId)).size;
  const perFileCount = new Map<number | undefined, number>();
  const selected: typeof scored = [];
  for (const item of scored) {
    if (selected.length >= MAX_RELEVANT_CHUNKS) break;
    if (distinctDocs > 1) {
      const count = perFileCount.get(item.documentId) ?? 0;
      if (count >= MAX_CHUNKS_PER_FILE) continue;
      perFileCount.set(item.documentId, count + 1);
    }
    selected.push(item);
  }

  const ordered = attachmentSet.size
    ? [...selected].sort(
        (a, b) =>
          Number(isAttachment(b.documentId)) -
          Number(isAttachment(a.documentId))
      )
    : selected;

  return expandSelectedWithNeighbors(
    ordered.map((item) => item.id),
    byId,
    vectorStore,
    sourceNamesById
  );
};

export type RetrieveOptions = Omit<
  RetrieveParams,
  'prompt' | 'vectorStore' | 'embeddings'
>;

export class Retriever {
  constructor(
    private vectorStore: OPSQLiteVectorStore,
    private embeddings?: LFMEmbeddings | null
  ) {}

  retrieve(query: string, options: RetrieveOptions): Promise<ContextChunk[]> {
    return retrieve({
      prompt: query,
      vectorStore: this.vectorStore,
      embeddings: this.embeddings,
      ...options,
    });
  }
}
