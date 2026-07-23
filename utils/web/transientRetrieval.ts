import { RecursiveCharacterTextSplitter } from 'react-native-rag';
import type { LFMEmbeddings } from '../lfmEmbeddings';
import type { WebSearchResult } from './types';
import type { WebRetrievalSignals } from './retrievalEvaluator';
import { extractQueryTerms, stemPrefix } from '../queryTerms';
import {
  adaptiveKeepCount,
  cosineSimilarity,
  maximalMarginalRelevance,
  reciprocalRankFusion,
  termCoverage,
  type MMRCandidate,
} from '../rankFusion';
import {
  ADAPTIVE_K_MIN_KEEP,
  COVERAGE_ALPHA,
  KEYWORD_WEIGHT,
  LEXICAL_MATCH_MIN_SIMILARITY,
  MIN_STITCH_OVERLAP,
  VECTOR_WEIGHT,
} from '../../constants/retrieval';
import {
  WEB_RETRIEVAL_CHUNK_CHARS,
  WEB_RETRIEVAL_CHUNK_OVERLAP,
  WEB_RETRIEVAL_MAX_CHUNKS,
  WEB_RETRIEVAL_MAX_PER_PAGE,
  WEB_RETRIEVAL_PAGE_MAX_CHARS,
  WEB_RETRIEVAL_TOP_K,
} from '../../constants/web';

export interface WebRetrievalQuery {
  semanticQuery: string;
  keywordQuery?: string;
}

export interface WebRetrievalResult {
  results: WebSearchResult[];
  signals: WebRetrievalSignals | null;
}

export type WebEmbeddingCache = Map<string, number[]>;

export const createWebEmbeddingCache = (): WebEmbeddingCache => new Map();

type WebChunk = {
  id: string;
  pageIndex: number;
  chunkIndex: number;
  text: string;
  embedding: number[];
  similarity: number;
  coverage: number;
};

const stripLeadingOverlap = (prev: string, next: string): string => {
  const max = Math.min(prev.length, next.length);
  for (let len = max; len >= MIN_STITCH_OVERLAP; len--) {
    if (prev.slice(prev.length - len) === next.slice(0, len)) {
      return next.slice(len);
    }
  }
  return next;
};

const stitchPassages = (passages: string[]): string => {
  if (passages.length === 0) return '';
  let stitched = passages[0]!;
  for (let i = 1; i < passages.length; i++) {
    const deduped = stripLeadingOverlap(stitched, passages[i]!).trimStart();
    if (deduped) stitched += `\n${deduped}`;
  }
  return stitched;
};

const chunkPages = async (results: WebSearchResult[]): Promise<WebChunk[]> => {
  const pages = results
    .map((result, pageIndex) => ({ result, pageIndex }))
    .filter(({ result }) => result.content?.trim());
  if (pages.length === 0) return [];

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: WEB_RETRIEVAL_CHUNK_CHARS,
    chunkOverlap: WEB_RETRIEVAL_CHUNK_OVERLAP,
  });
  const perPageCap = Math.ceil(WEB_RETRIEVAL_MAX_CHUNKS / pages.length);

  const chunks: WebChunk[] = [];
  for (const { result, pageIndex } of pages) {
    const text = result.content!.trim().slice(0, WEB_RETRIEVAL_PAGE_MAX_CHARS);
    const split = (await splitter.splitText(text)).slice(0, perPageCap);
    split.forEach((chunkText, chunkIndex) => {
      const trimmed = chunkText.trim();
      if (!trimmed) return;
      chunks.push({
        id: `${pageIndex}:${chunkIndex}`,
        pageIndex,
        chunkIndex,
        text: trimmed,
        embedding: [],
        similarity: 0,
        coverage: 0,
      });
    });
  }
  return chunks.slice(0, WEB_RETRIEVAL_MAX_CHUNKS);
};

export const retrieveWebPassages = async (
  results: WebSearchResult[],
  query: WebRetrievalQuery,
  embeddings: LFMEmbeddings,
  cache?: WebEmbeddingCache
): Promise<WebRetrievalResult> => {
  const chunks = await chunkPages(results);
  if (chunks.length === 0) return { results, signals: null };

  const queryKey = `q:${query.semanticQuery}`;

  let queryEmbedding: number[];
  try {
    queryEmbedding =
      cache?.get(queryKey) ??
      (await embeddings.embedQuery(query.semanticQuery));
    cache?.set(queryKey, queryEmbedding);
    for (const chunk of chunks) {
      const key = `d:${chunk.text}`;
      chunk.embedding =
        cache?.get(key) ?? (await embeddings.embedDocument(chunk.text));
      cache?.set(key, chunk.embedding);
      chunk.similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
    }
  } catch (error) {
    console.warn('Web transient retrieval skipped (embedding failed)', error);
    return { results, signals: null };
  }

  const coverageTerms = new Set(
    [
      ...extractQueryTerms(query.semanticQuery),
      ...extractQueryTerms(query.keywordQuery ?? ''),
    ].map(stemPrefix)
  );
  for (const chunk of chunks) {
    chunk.coverage = termCoverage(chunk.text, coverageTerms);
  }

  const maxSimilarity = Math.max(...chunks.map((chunk) => chunk.similarity));
  const topCoverage = Math.max(...chunks.map((chunk) => chunk.coverage));
  const signalsFor = (qualified: WebChunk[]): WebRetrievalSignals => ({
    embedded: true,
    chunkCount: chunks.length,
    qualifiedCount: qualified.length,
    distinctPages: new Set(qualified.map((chunk) => chunk.pageIndex)).size,
    maxSimilarity,
    topCoverage,
  });

  const qualified = chunks.filter(
    (chunk) =>
      chunk.coverage > 0 || chunk.similarity >= LEXICAL_MATCH_MIN_SIMILARITY
  );
  if (qualified.length === 0) return { results, signals: signalsFor([]) };

  const vectorRanked = [...qualified].sort(
    (a, b) => b.similarity - a.similarity
  );
  const keywordRanked = qualified
    .filter((chunk) => chunk.coverage > 0)
    .sort((a, b) => b.coverage - a.coverage);
  const fused = reciprocalRankFusion([
    { ids: vectorRanked.map((c) => c.id), weight: VECTOR_WEIGHT },
    { ids: keywordRanked.map((c) => c.id), weight: KEYWORD_WEIGHT },
  ]);
  const maxFused = Math.max(
    ...qualified.map((c) => fused.get(c.id) ?? 0),
    Number.EPSILON
  );

  const byId = new Map(qualified.map((chunk) => [chunk.id, chunk]));
  const relevanceById = new Map<string, number>();
  const mmrCandidates: MMRCandidate[] = qualified.map((chunk) => {
    const base = (fused.get(chunk.id) ?? 0) / maxFused;
    const relevance = base * (1 + COVERAGE_ALPHA * chunk.coverage);
    relevanceById.set(chunk.id, relevance);
    return { id: chunk.id, relevance, embedding: chunk.embedding };
  });

  const distinctPages = new Set(qualified.map((c) => c.pageIndex)).size;
  const selected = maximalMarginalRelevance(
    mmrCandidates,
    WEB_RETRIEVAL_TOP_K,
    undefined,
    distinctPages > 1
      ? {
          groupOf: (candidate) =>
            String(byId.get(candidate.id)?.pageIndex ?? ''),
          maxPerGroup: WEB_RETRIEVAL_MAX_PER_PAGE,
        }
      : undefined
  );

  const byRelevance = [...selected].sort(
    (a, b) => (relevanceById.get(b.id) ?? 0) - (relevanceById.get(a.id) ?? 0)
  );
  const keepCount = adaptiveKeepCount(
    byRelevance.map((item) => relevanceById.get(item.id) ?? 0),
    ADAPTIVE_K_MIN_KEEP
  );
  const keptIds = new Set(byRelevance.slice(0, keepCount).map((i) => i.id));

  const keptByPage = new Map<number, WebChunk[]>();
  for (const chunk of qualified) {
    if (!keptIds.has(chunk.id)) continue;
    const list = keptByPage.get(chunk.pageIndex) ?? [];
    list.push(chunk);
    keptByPage.set(chunk.pageIndex, list);
  }

  const rewritten = results.map((result, pageIndex) => {
    if (!result.content) return result;
    const kept = keptByPage.get(pageIndex);
    if (!kept?.length) {
      return { ...result, content: undefined };
    }
    const passages = [...kept]
      .sort((a, b) => a.chunkIndex - b.chunkIndex)
      .map((chunk) => chunk.text);
    return { ...result, content: stitchPassages(passages) };
  });

  return { results: rewritten, signals: signalsFor(qualified) };
};
