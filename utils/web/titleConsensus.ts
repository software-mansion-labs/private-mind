import type { WebSearchResult } from './types';
import { registrableDomain } from './sourceAgreement';
import { extractQueryTerms, foldForMatching, stemPrefix } from '../queryTerms';
import { detectQuestionLanguage } from '../questionLanguage';

const CAPITALIZED = /^\p{Lu}[\p{L}'’-]+$/u;
const SEGMENT_SPLIT = /\s+[-–—|:·»]\s+/;
const MIN_ASSERTION_TOKENS = 2;

const tokensOf = (text: string): string[] =>
  text.split(/[^\p{L}'’-]+/u).filter(Boolean);

const entityRuns = (tokens: string[]): string[][] => {
  const runs: string[][] = [];
  let current: string[] = [];
  let runStart = 0;
  const flush = () => {
    if (current.length >= 2 || (current.length === 1 && runStart > 0)) {
      runs.push(current);
    }
    current = [];
  };
  tokens.forEach((token, index) => {
    if (CAPITALIZED.test(token)) {
      if (current.length === 0) runStart = index;
      current.push(token);
    } else {
      flush();
    }
  });
  flush();
  return runs;
};

export const promoteTitleConsensus = (
  results: WebSearchResult[],
  query: string
): WebSearchResult[] => {
  if (results.length < 2) return results;

  const stems = [
    ...extractQueryTerms(query, detectQuestionLanguage(query)?.code),
  ].map((term) => stemPrefix(foldForMatching(term)));
  const isQueryRun = (run: string[]): boolean =>
    run.every((token) => {
      const folded = foldForMatching(token);
      return stems.some((stem) => folded.startsWith(stem));
    });

  const assertionTokens = (title: string): string[] => {
    const segments = title.split(SEGMENT_SPLIT);
    if (segments.length < 2) return tokensOf(title);
    const tail = segments.at(-1)!;
    return entityRuns(tokensOf(tail)).length > 0
      ? tokensOf(title)
      : tokensOf(segments.slice(0, -1).join(' '));
  };

  const hostsByEntity = new Map<string, Set<string>>();
  const entitiesByIndex = results.map((result) => {
    if (!result.title) return [];
    const tokens = assertionTokens(result.title);
    const runs = entityRuns(tokens).filter((run) => !isQueryRun(run));
    const keys = runs
      .filter((run) => tokens.length - run.length >= MIN_ASSERTION_TOKENS)
      .map((run) => run.map(foldForMatching).join(' '));
    const host = registrableDomain(result.url);
    if (host) {
      for (const key of keys) {
        const hosts = hostsByEntity.get(key) ?? new Set<string>();
        hosts.add(host);
        hostsByEntity.set(key, hosts);
      }
    }
    return keys;
  });

  const scoreOf = (index: number): number =>
    Math.max(
      0,
      ...entitiesByIndex[index]!.map((key) => {
        const hosts = hostsByEntity.get(key)?.size ?? 0;
        return hosts >= 2 ? hosts : 0;
      })
    );

  let bestIndex = -1;
  let bestScore = 0;
  results.forEach((result, index) => {
    if (!result.content?.trim()) return;
    const score = scoreOf(index);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  if (bestIndex <= 0) return results;

  const reordered = [...results];
  const [promoted] = reordered.splice(bestIndex, 1);
  reordered.unshift(promoted!);
  return reordered;
};
