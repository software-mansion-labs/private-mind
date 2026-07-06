import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import { type Scalar } from '@op-engineering/op-sqlite';
import { LFMEmbeddings } from './lfmEmbeddings';
import { extractQueryTerms, stemPrefix } from './queryTerms';
import { keywordSearch } from '../database/keywordIndex';
import { type ContextChunk } from './contextUtils';
import {
  cosineSimilarity,
  maximalMarginalRelevance,
  reciprocalRankFusion,
  termCoverage,
  type MMRCandidate,
} from './rankFusion';
import {
  ATTACHMENT_RELEVANCE_BONUS,
  CANDIDATE_POOL,
  COVERAGE_ALPHA,
  KEYWORD_WEIGHT,
  LEXICAL_MATCH_MIN_SIMILARITY,
  MAX_RELEVANT_CHUNKS,
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

  const [vectorResults, keywordHits] = await Promise.all([
    vectorStore.query({
      ...(queryEmbedding ? { queryEmbedding } : { queryText: prompt }),
      predicate: (r) => enabledSet.has(r.metadata?.documentId),
      nResults: CANDIDATE_POOL,
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

  const qualified = [...byId.values()].filter((candidate) => {
    if (isAttachment(candidate.documentId)) return true;
    if (keywordIds.has(candidate.id)) return true;
    if (candidate.similarity >= STRONG_SEMANTIC_THRESHOLD) return true;
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

  const mmrCandidates: MMRCandidate[] = qualified.map((candidate) => {
    const base = (fused.get(candidate.id) ?? 0) / maxFused;
    const coverage = coverageOf(candidate);
    return {
      id: candidate.id,
      relevance:
        base * (1 + COVERAGE_ALPHA * coverage) +
        (isAttachment(candidate.documentId) ? ATTACHMENT_RELEVANCE_BONUS : 0),
      embedding: candidate.embedding,
    };
  });

  const selected = maximalMarginalRelevance(mmrCandidates, MAX_RELEVANT_CHUNKS);

  const ordered = attachmentSet.size
    ? [...selected].sort(
        (a, b) =>
          Number(isAttachment(byId.get(b.id)?.documentId)) -
          Number(isAttachment(byId.get(a.id)?.documentId))
      )
    : selected;

  return ordered
    .map((item) => byId.get(item.id))
    .filter((candidate): candidate is Candidate => candidate !== undefined)
    .map((candidate) => ({
      document: candidate.document,
      similarity: candidate.similarity,
      metadata: {
        documentId: candidate.documentId,
        name: candidate.name,
      },
    }));
};
