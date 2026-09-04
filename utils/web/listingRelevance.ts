import type { WebSearchResult } from './types';
import type { WebIntentKind } from './intentKind';
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

const ANCHOR_TAIL = /^[\p{Lu}\p{Lt}][\p{L}\p{N}'’-]*$/u;
const HAS_DIGIT = /\p{N}/u;

export const anchorTerms = (query: string): string[] => {
  const raw = query.split(/[^\p{L}\p{N}'’-]+/u).filter(Boolean);
  const anchors = raw.filter((token, index) => {
    if (HAS_DIGIT.test(token)) return true;
    return index > 0 && ANCHOR_TAIL.test(token) && token.length >= 2;
  });
  return [
    ...new Set(anchors.map((token) => stemPrefix(foldForMatching(token)))),
  ];
};

const ANCHOR_BONUS = 3;
const OFF_SUBJECT_FACTOR = 0.25;

const ANCHOR_SUBSTRING_MIN_LEN = 4;
const REGEXP_SPECIAL = /[.*+?^${}()|[\]\\]/g;

const anchorMatcher = (anchor: string): ((text: string) => boolean) => {
  if (anchor.length >= ANCHOR_SUBSTRING_MIN_LEN) {
    return (text) => text.includes(anchor);
  }
  const bounded = new RegExp(
    `(?<![\\p{L}\\p{N}])${anchor.replace(REGEXP_SPECIAL, '\\$&')}(?![\\p{L}\\p{N}])`,
    'u'
  );
  return (text) => bounded.test(text);
};

const TITLE_FIGURE_BONUS = 1.5;
const ANSWER_FIGURE_BONUS = 2;

const FIGURE_KINDS: ReadonlySet<WebIntentKind> = new Set([
  'price',
  'specs',
  'fact',
]);

const SEPARATED_OR_DECIMAL_FIGURE =
  /\d{1,3}(?:[.,\u00A0\u202F ]\d{3})+(?:[.,]\d+)?|\d{5,}|\d+[.,]\d+/;

const hasAnswerFigure = (text: string): boolean =>
  SEPARATED_OR_DECIMAL_FIGURE.test(text);

const CURRENCY_PAIR_PATTERN = /\b[A-Z]{2,6}[/-][A-Z]{2,6}\b/;
const CONVERTER_SLUG_PATTERN = /convert|calculat|exchange-?rate|cross-?rate/i;
const CROSS_ASSET_PENALTY = 2;

const looksLikeCrossAssetPage = (result: WebSearchResult): boolean =>
  CURRENCY_PAIR_PATTERN.test(`${result.title ?? ''} ${result.url}`) ||
  CONVERTER_SLUG_PATTERN.test(result.url);

const excludeCrossAssetIfAlternatives = <T extends WebSearchResult>(
  results: T[]
): T[] => {
  const clean = results.filter((result) => !looksLikeCrossAssetPage(result));
  return clean.length > 0 ? clean : results;
};

const YEAR_TOKEN = /(?<![\p{N}])(?:19|20)\d{2}(?![\p{N}])/gu;
const YEAR_BONUS = 2;
const OFF_YEAR_FACTOR = 0.25;

export const scopeYearsOf = (queries: string[]): string[] => [
  ...new Set(queries.flatMap((query) => query.match(YEAR_TOKEN) ?? [])),
];

const mentionsAnyYear = (result: WebSearchResult, years: string[]): boolean => {
  const text = `${result.title ?? ''} ${result.snippet ?? ''} ${result.url}`;
  return years.some((year) => text.includes(year));
};

export interface ListingRankOptions {
  kind?: WebIntentKind;
  scopeYears?: string[];
}

export const rankByListingRelevance = <T extends WebSearchResult>(
  rawResults: T[],
  query: string | undefined,
  options: ListingRankOptions = {}
): T[] => {
  const results = excludeCrossAssetIfAlternatives(rawResults);
  if (results.length < 2 || !query?.trim()) return results;
  const needles = questionTerms(query);
  if (needles.length === 0) return results;

  const quantityAsked = !!options.kind && FIGURE_KINDS.has(options.kind);
  const scopeYears = options.scopeYears ?? [];
  const yearsDiscriminate =
    scopeYears.length > 0 &&
    results.some((result) => mentionsAnyYear(result, scopeYears));
  const anchors = anchorTerms(query);
  const foldedTitles = results.map((result) =>
    foldForMatching(result.title ?? '')
  );
  const folded = results.map((result) =>
    foldForMatching(`${result.title ?? ''} ${result.snippet ?? ''}`)
  );
  const matchers = anchors.map(anchorMatcher);
  const anchorHits = folded.map((text) =>
    matchers.reduce((hits, matches) => hits + (matches(text) ? 1 : 0), 0)
  );
  const anchorsDiscriminate =
    anchors.length > 0 && anchorHits.some((hits) => hits > 0);
  const anchorScore = (index: number): number =>
    anchorsDiscriminate
      ? ANCHOR_BONUS * (anchorHits[index]! / anchors.length)
      : 0;
  const inScope = results.map((result) =>
    yearsDiscriminate ? mentionsAnyYear(result, scopeYears) : true
  );
  const frameFactor = (index: number): number =>
    (anchorsDiscriminate && anchorHits[index] === 0 ? OFF_SUBJECT_FACTOR : 1) *
    (inScope[index] ? 1 : OFF_YEAR_FACTOR);
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
        ) *
          frameFactor(index) +
        (hasMoneyAnchor(folded[index]!) ? MONEY_BONUS : 0) +
        (hasMoneyAnchor(foldedTitles[index]!) ? TITLE_FIGURE_BONUS : 0) +
        (quantityAsked && hasAnswerFigure(foldedTitles[index]!)
          ? ANSWER_FIGURE_BONUS
          : 0) +
        anchorScore(index) +
        (yearsDiscriminate && inScope[index] ? YEAR_BONUS : 0) -
        (looksLikeCrossAssetPage(result) ? CROSS_ASSET_PENALTY : 0),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.result);

  const top = results[0]!;
  const topMissesAnchors = anchorsDiscriminate && anchorHits[0] === 0;
  const at = ranked.indexOf(top);
  if (at > 1 && !topMissesAnchors) {
    ranked.splice(at, 1);
    ranked.splice(1, 0, top);
  }
  return ranked;
};

export const fairRankByListingRelevance = <T extends WebSearchResult>(
  groups: T[][],
  query: string | undefined,
  cap: number,
  options: ListingRankOptions = {}
): T[] => {
  const nonEmpty = groups.filter((group) => group.length > 0);
  if (nonEmpty.length <= 1) {
    return rankByListingRelevance(nonEmpty[0] ?? [], query, options).slice(
      0,
      cap
    );
  }

  const ranked = nonEmpty.map((group) =>
    rankByListingRelevance(group, query, options)
  );
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
