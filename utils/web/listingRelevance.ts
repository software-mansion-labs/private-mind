import type { WebSearchResult } from './types';
import { foldForMatching, stemPrefix } from '../queryTerms';
import { MONEY_ANCHOR } from './webResultsToContext';

const questionTerms = (query: string): string[] => [
  ...new Set(
    foldForMatching(query)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= 3)
      .map(stemPrefix)
  ),
];

const MONEY_BONUS = 1.5;

const hasMoneyAnchor = (folded: string): boolean =>
  folded.match(MONEY_ANCHOR) !== null;

const CROSS_ASSET_PATTERN =
  /\b[A-Z]{2,6}[/-][A-Z]{2,6}\b|\bconvert(?:er|ing)?\b|\bcalculat(?:e|or)\b|\bexchange\s?rate\b|\bcross\s?rate\b/i;
const CROSS_ASSET_PENALTY = 2;

const looksLikeCrossAssetPage = (result: WebSearchResult): boolean =>
  CROSS_ASSET_PATTERN.test(`${result.title ?? ''} ${result.url}`);

const excludeCrossAssetIfAlternatives = <T extends WebSearchResult>(
  results: T[]
): T[] => {
  const clean = results.filter((result) => !looksLikeCrossAssetPage(result));
  return clean.length > 0 ? clean : results;
};

const PERIOD_SCOPE_MARKERS =
  /w tym roku|tego roku|w tym sezonie|tego sezonu|dotychczas w (?:tym roku|sezonie)|this year|this season|so far this (?:year|season)/i;
const EVENT_SCOPE_MARKERS =
  /\bin (?:that|this) (?:game|match)\b|\bfrom (?:that|this) (?:game|match)\b|\bduring (?:that|this) (?:game|match)\b|w (?:tym|tamtym) meczu|z (?:tego|tamtego) meczu|w (?:tej|tamtej) grze/i;
const SUPERLATIVE_MARKERS =
  /najwi[eę]cej|najlepsz|najskuteczniejsz|\brekord|\bmost\b|\bbest\b|\btop\b|\bhighest\b|\bleading\b/i;
const ALL_TIME_PAGE_PATTERN =
  /\ball[\s-]?time\b|\bcareer\b|wszech ?czas[óo]w|w (?:całej )?karierze|rekordzist|rekordnationalspieler|hall of fame|\brecord\b[^.!?]{0,20}\b(?:scorers?|holders?|goalscorers?|leaders?)\b|\ball-time leaders?\b|single[\s-]game leaders? and records?/i;
const ALL_TIME_PAGE_PENALTY = 2;

const isPeriodScopedRecordQuery = (query: string | undefined): boolean =>
  !!query &&
  (PERIOD_SCOPE_MARKERS.test(query) || EVENT_SCOPE_MARKERS.test(query)) &&
  SUPERLATIVE_MARKERS.test(query);

const looksLikeAllTimePage = (result: WebSearchResult): boolean =>
  ALL_TIME_PAGE_PATTERN.test(`${result.title ?? ''} ${result.url}`);

const excludeAllTimeIfPeriodScoped = <T extends WebSearchResult>(
  results: T[],
  query: string | undefined
): T[] =>
  isPeriodScopedRecordQuery(query)
    ? results.filter((result) => !looksLikeAllTimePage(result))
    : results;

export const rankByListingRelevance = <T extends WebSearchResult>(
  rawResults: T[],
  query: string | undefined
): T[] => {
  const periodScoped = isPeriodScopedRecordQuery(query);
  const results = excludeAllTimeIfPeriodScoped(
    excludeCrossAssetIfAlternatives(rawResults),
    query
  );
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
      score:
        needles.reduce(
          (sum, needle, i) =>
            folded[index]!.includes(needle) ? sum + weights[i]! : sum,
          0
        ) +
        (hasMoneyAnchor(folded[index]!) ? MONEY_BONUS : 0) -
        (looksLikeCrossAssetPage(result) ? CROSS_ASSET_PENALTY : 0) -
        (periodScoped && looksLikeAllTimePage(result)
          ? ALL_TIME_PAGE_PENALTY
          : 0),
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

export const fairRankByListingRelevance = <T extends WebSearchResult>(
  groups: T[][],
  query: string | undefined,
  cap: number
): T[] => {
  const nonEmpty = groups.filter((group) => group.length > 0);
  if (nonEmpty.length <= 1) {
    return rankByListingRelevance(nonEmpty[0] ?? [], query).slice(0, cap);
  }

  const ranked = nonEmpty.map((group) => rankByListingRelevance(group, query));
  const result: T[] = [];
  for (let round = 0; result.length < cap; round++) {
    const before = result.length;
    for (const group of ranked) {
      if (result.length >= cap) break;
      const item = group[round];
      if (item) result.push(item);
    }
    if (result.length === before) break;
  }
  return result;
};
