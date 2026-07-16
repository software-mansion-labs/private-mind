import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import { type Scalar } from '@op-engineering/op-sqlite';
import { LFMEmbeddings } from './lfmEmbeddings';
import { extractQueryTerms, stemPrefix } from './queryTerms';
import { keywordSearch } from '../database/keywordIndex';
import { type ContextChunk, sourceKey } from './contextUtils';
import {
  adaptiveKeepCount,
  cosineSimilarity,
  maximalMarginalRelevance,
  reciprocalRankFusion,
  termCoverage,
  type MMRCandidate,
} from './rankFusion';
import {
  ADAPTIVE_K_MIN_KEEP,
  ATTACHMENT_RELEVANCE_BONUS,
  CANDIDATE_POOL,
  COVERAGE_ALPHA,
  KEYWORD_WEIGHT,
  LEXICAL_MATCH_MIN_SIMILARITY,
  MAX_CHUNKS_PER_FILE,
  MAX_RELEVANT_CHUNKS,
  SEMANTIC_TOP_KEEP_FLOOR,
  STRONG_SEMANTIC_THRESHOLD,
  VECTOR_WEIGHT,
} from '../constants/retrieval';

// Hybrid retrieval: fuse semantic vector + keyword (BM25/FTS5) search, then
// re-rank (RRF + term-coverage boost + MMR) down to the final chunks. No
// cross-encoder — see rankFusion.ts. Output feeds formatContextChunks /
// getSourceDocumentsFromChunks unchanged, preserving the "Source N" ↔ citation map.

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

// Loads full chunk rows by id to hydrate keyword-only hits absent from the
// vector pool, so they can be re-ranked on equal footing.
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

    // Order chunks as relevance-ranked windows: seeds most- to least-relevant,
    // each emitting its [seed-1, seed, seed+1] run in document order (deduped),
    // so the matched chunk leads and a later budget truncation trims the tail.
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

export type HybridRetrieveParams = {
  prompt: string;
  enabledSourceIds: number[];
  vectorStore: OPSQLiteVectorStore;
  sourceNamesById: Map<number, string>;
  embeddings?: LFMEmbeddings | null;
  attachmentSourceIds?: number[];
};

export const hybridRetrieve = async ({
  prompt,
  enabledSourceIds,
  vectorStore,
  sourceNamesById,
  embeddings,
  attachmentSourceIds = [],
}: HybridRetrieveParams): Promise<ContextChunk[]> => {
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

  const terms = extractQueryTerms(prompt);
  const coverageTerms = new Set([...terms].map(stemPrefix));

  // Isolate the vector query: without a usable embedding the store re-embeds and
  // rejects, so catch here to degrade to keyword-only instead of returning nothing.
  const [vectorResults, keywordHits] = await Promise.all([
    vectorStore
      .query({
        ...(queryEmbedding ? { queryEmbedding } : { queryText: prompt }),
        predicate: (r) => enabledSet.has(r.metadata?.documentId),
        nResults: CANDIDATE_POOL,
      })
      .catch((error) => {
        console.warn(
          'Vector query failed; degrading to keyword-only retrieval',
          error
        );
        return [] as Awaited<ReturnType<typeof vectorStore.query>>;
      }),
    keywordSearch(vectorStore.db, [...terms], enabledSourceIds, CANDIDATE_POOL),
  ]);
  const keywordIds = new Set(keywordHits.map((hit) => hit.chunkId));

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

  const missingIds = keywordHits
    .map((hit) => hit.chunkId)
    .filter((id) => !byId.has(id));
  const hydrated = await hydrateChunksByIds(vectorStore, missingIds);
  for (const row of hydrated) {
    byId.set(row.id, {
      id: row.id,
      document: row.document,
      embedding: row.embedding,
      documentId: row.documentId,
      name: resolveName(row.name, row.documentId, sourceNamesById),
      similarity: queryEmbedding
        ? cosineSimilarity(queryEmbedding, row.embedding)
        : 0,
    });
  }

  const fused = reciprocalRankFusion([
    { ids: vectorResults.map((r) => r.id), weight: VECTOR_WEIGHT },
    { ids: keywordHits.map((h) => h.chunkId), weight: KEYWORD_WEIGHT },
  ]);

  const coverageById = new Map<string, number>();
  const coverageOf = (candidate: Candidate): number => {
    let coverage = coverageById.get(candidate.id);
    if (coverage === undefined) {
      coverage = termCoverage(
        `${candidate.name ?? ''} ${candidate.document ?? ''}`,
        coverageTerms
      );
      coverageById.set(candidate.id, coverage);
    }
    return coverage;
  };

  const candidates = [...byId.values()];
  const topSemantic = candidates.reduce<Candidate | null>(
    (best, candidate) =>
      candidate.similarity > (best?.similarity ?? -Infinity) ? candidate : best,
    null
  );

  const qualified = candidates.filter((candidate) => {
    if (isAttachment(candidate.documentId)) return true;
    if (keywordIds.has(candidate.id)) {
      if (!queryEmbedding) return true;
      if (candidate.similarity >= LEXICAL_MATCH_MIN_SIMILARITY) return true;
    }
    if (candidate.similarity >= STRONG_SEMANTIC_THRESHOLD) return true;
    if (
      candidate === topSemantic &&
      candidate.similarity >= SEMANTIC_TOP_KEEP_FLOOR
    ) {
      return true;
    }
    return (
      candidate.similarity >= LEXICAL_MATCH_MIN_SIMILARITY &&
      coverageOf(candidate) > 0
    );
  });

  if (qualified.length === 0) return [];

  const maxFused = Math.max(
    ...qualified.map((c) => fused.get(c.id) ?? 0),
    Number.EPSILON
  );

  const baseRelevanceById = new Map<string, number>();
  const mmrCandidates: MMRCandidate[] = qualified.map((candidate) => {
    const base = (fused.get(candidate.id) ?? 0) / maxFused;
    const coverage = coverageOf(candidate);
    const baseRelevance = base * (1 + COVERAGE_ALPHA * coverage);
    baseRelevanceById.set(candidate.id, baseRelevance);
    return {
      id: candidate.id,
      relevance:
        baseRelevance +
        (isAttachment(candidate.documentId) ? ATTACHMENT_RELEVANCE_BONUS : 0),
      embedding: candidate.embedding,
    };
  });

  // Cap chunks per document only when the pool spans several documents, so one
  // long or freshly-attached file can't evict every other enabled source.
  const distinctDocs = new Set(qualified.map((c) => c.documentId)).size;
  const selected = maximalMarginalRelevance(
    mmrCandidates,
    MAX_RELEVANT_CHUNKS,
    undefined,
    distinctDocs > 1
      ? {
          groupOf: (candidate) => {
            const documentId = byId.get(candidate.id)?.documentId;
            return typeof documentId === 'number'
              ? String(documentId)
              : undefined;
          },
          maxPerGroup: MAX_CHUNKS_PER_FILE,
        }
      : undefined
  );

  // Adaptive-k on the non-attachment tail: drop chunks past the first large
  // relevance gap so a weak distractor never reaches the small reader.
  // Attachment chunks are always kept — they are the explicit subject of the turn.
  const nonAttachmentByRelevance = selected
    .filter((item) => !isAttachment(byId.get(item.id)?.documentId))
    .sort(
      (a, b) =>
        (baseRelevanceById.get(b.id) ?? 0) - (baseRelevanceById.get(a.id) ?? 0)
    );
  const keepCount = adaptiveKeepCount(
    nonAttachmentByRelevance.map((item) => baseRelevanceById.get(item.id) ?? 0),
    ADAPTIVE_K_MIN_KEEP
  );
  const keptNonAttachmentIds = new Set(
    nonAttachmentByRelevance.slice(0, keepCount).map((item) => item.id)
  );
  const kept = selected.filter(
    (item) =>
      isAttachment(byId.get(item.id)?.documentId) ||
      keptNonAttachmentIds.has(item.id)
  );

  const ordered = attachmentSet.size
    ? [...kept].sort(
        (a, b) =>
          Number(isAttachment(byId.get(b.id)?.documentId)) -
          Number(isAttachment(byId.get(a.id)?.documentId))
      )
    : kept;

  return expandSelectedWithNeighbors(
    ordered.map((item) => item.id),
    byId,
    vectorStore,
    sourceNamesById
  );
};

// Thin app↔library boundary. Binds the store + embeddings so retrieval is a
// single retrieve(query, options) call, making the hybrid testable and portable
// in isolation. It forwards to hybridRetrieve unchanged — no interface, because
// there is one implementation and one caller; extract a Retriever interface only
// if a second retriever ever appears. Deliberately NOT `implements VectorStore`:
// the hybrid is read-only and its ContextChunk output drops id/embedding, so
// coercing to QueryResult would change retrieval results.
export type HybridRetrieveOptions = Omit<
  HybridRetrieveParams,
  'prompt' | 'vectorStore' | 'embeddings'
>;

export class HybridRetriever {
  constructor(
    private vectorStore: OPSQLiteVectorStore,
    private embeddings?: LFMEmbeddings | null
  ) {}

  retrieve(
    query: string,
    options: HybridRetrieveOptions
  ): Promise<ContextChunk[]> {
    return hybridRetrieve({
      prompt: query,
      vectorStore: this.vectorStore,
      embeddings: this.embeddings,
      ...options,
    });
  }
}
