import type { WebSearchResult } from './types';
import { foldForMatching, stemPrefix } from '../queryTerms';

const questionTerms = (query: string): string[] => [
  ...new Set(
    foldForMatching(query)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= 3)
      .map(stemPrefix)
  ),
];

export const rankByListingRelevance = <T extends WebSearchResult>(
  results: T[],
  query: string | undefined
): T[] => {
  if (results.length < 2 || !query?.trim()) return results;
  const needles = questionTerms(query);
  if (needles.length === 0) return results;

  const folded = results.map((result) =>
    foldForMatching(`${result.title ?? ''} ${result.snippet ?? ''}`)
  );
  const weights = needles.map((needle) => {
    const hits = folded.reduce(
      (count, text) => count + (text.includes(needle) ? 1 : 0),
      0
    );
    return hits === 0 ? 0 : Math.log((results.length + 1) / hits);
  });

  const ranked = results
    .map((result, index) => ({
      result,
      index,
      score: needles.reduce(
        (sum, needle, i) =>
          folded[index]!.includes(needle) ? sum + weights[i]! : sum,
        0
      ),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.result);

  const top = results[0]!;
  const at = ranked.indexOf(top);
  if (at > 1) {
    ranked.splice(at, 1);
    ranked.splice(1, 0, top);
  }
  return ranked;
};
