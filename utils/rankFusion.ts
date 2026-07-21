import {
  RRF_K,
  MMR_LAMBDA,
  ADAPTIVE_K_DROP_RATIO,
} from '../constants/retrieval';

// Pure scoring primitives for hybrid retrieval — plain arithmetic, no model/IO.

export type RankedList = {
  ids: string[];
  weight?: number;
};

// Fuses rank-ordered lists via `Σ weight / (k + rank)` — uses rank position, not
// raw scores, so it mixes incomparable scales (cosine vs BM25). `ids` run
// best-first; each list's `weight` defaults to 1; `k` dampens the top ranks.
export const reciprocalRankFusion = (
  lists: RankedList[],
  k = RRF_K
): Map<string, number> => {
  const scores = new Map<string, number>();

  for (const { ids, weight = 1 } of lists) {
    ids.forEach((id, index) => {
      const contribution = weight / (k + index + 1);
      scores.set(id, (scores.get(id) ?? 0) + contribution);
    });
  }

  return scores;
};

// Cosine similarity; normalises internally (LFM2.5 embeddings are non-unit-length).
// Returns 0 when either vector is empty or zero-length, or when they differ in length.
export const cosineSimilarity = (a: number[], b: number[]): number => {
  const len = a.length;
  if (len === 0 || b.length !== len) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

// Fraction (0..1) of `terms` present as substrings of `text` — rewards exact
// keyword coverage during re-ranking.
export const termCoverage = (text: string, terms: Set<string>): number => {
  if (terms.size === 0) return 0;

  const lower = text.toLowerCase();
  let hits = 0;
  for (const term of terms) {
    if (lower.includes(term)) hits += 1;
  }

  return hits / terms.size;
};

export type MMRCandidate = {
  id: string;
  relevance: number;
  embedding: number[];
};

export type MMROptions = {
  groupOf?: (candidate: MMRCandidate) => string | undefined;
  maxPerGroup?: number;
};

// Maximal Marginal Relevance: greedily picks `count` candidates, each maximising
// `λ·relevance − (1−λ)·maxSimilarityToPicked` — relevant but non-duplicate.
// `relevance` may be any scale (only order matters); `lambda` trades relevance
// vs diversity. An optional per-group cap keeps one document (or any group) from
// filling every slot. O(count·pool·dim), no cross-encoder.
export const maximalMarginalRelevance = (
  candidates: MMRCandidate[],
  count: number,
  lambda = MMR_LAMBDA,
  { groupOf, maxPerGroup }: MMROptions = {}
): MMRCandidate[] => {
  const remaining = [...candidates];
  const selected: MMRCandidate[] = [];
  const groupCounts = new Map<string, number>();

  const isGroupFull = (candidate: MMRCandidate): boolean => {
    if (!groupOf || !maxPerGroup) return false;
    const group = groupOf(candidate);
    if (group === undefined) return false;
    return (groupCounts.get(group) ?? 0) >= maxPerGroup;
  };

  while (selected.length < count && remaining.length > 0) {
    let bestIndex = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i]!;
      if (isGroupFull(candidate)) continue;

      let maxSimilarity = 0;
      for (const picked of selected) {
        const similarity = cosineSimilarity(
          candidate.embedding,
          picked.embedding
        );
        if (similarity > maxSimilarity) maxSimilarity = similarity;
      }

      const score = lambda * candidate.relevance - (1 - lambda) * maxSimilarity;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) break;

    const picked = remaining.splice(bestIndex, 1)[0]!;
    selected.push(picked);
    const group = groupOf?.(picked);
    if (group !== undefined) {
      groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
    }
  }

  return selected;
};

// Keep leading items until relevance drops below `dropRatio × previous`; at least `minKeep`.
export const adaptiveKeepCount = (
  sortedScoresDesc: number[],
  minKeep = 1,
  dropRatio = ADAPTIVE_K_DROP_RATIO
): number => {
  const total = sortedScoresDesc.length;
  if (total <= minKeep) return total;

  for (let i = Math.max(1, minKeep); i < total; i++) {
    const prev = sortedScoresDesc[i - 1]!;
    const curr = sortedScoresDesc[i]!;
    if (prev > 0 && curr < dropRatio * prev) return i;
  }

  return total;
};
