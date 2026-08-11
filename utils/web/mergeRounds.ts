import type { WebSearchResult } from './types';

export const interleaveByRound = (
  ...rounds: WebSearchResult[][]
): WebSearchResult[] => {
  const merged: WebSearchResult[] = [];
  const longest = Math.max(0, ...rounds.map((round) => round.length));
  for (let index = 0; index < longest; index += 1) {
    for (const round of rounds) {
      const result = round[index];
      if (result) merged.push(result);
    }
  }
  return merged;
};
