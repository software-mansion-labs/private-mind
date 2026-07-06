import { RRF_K, MMR_LAMBDA } from '../constants/retrieval';

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
// Returns 0 when either vector is empty or zero-length.
export const cosineSimilarity = (a: number[], b: number[]): number => {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;

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

// Maximal Marginal Relevance: greedily picks `count` candidates, each maximising
// `λ·relevance − (1−λ)·maxSimilarityToPicked` — relevant but non-duplicate.
// `relevance` may be any scale (only order matters); `lambda` trades relevance
// vs diversity. O(count·pool·dim), no cross-encoder.
export const maximalMarginalRelevance = (
  candidates: MMRCandidate[],
  count: number,
  lambda = MMR_LAMBDA
): MMRCandidate[] => {
  const remaining = [...candidates];
  const selected: MMRCandidate[] = [];

  while (selected.length < count && remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i]!;

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

    selected.push(remaining.splice(bestIndex, 1)[0]!);
  }

  return selected;
};
