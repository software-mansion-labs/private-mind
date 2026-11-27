import {
  WEB_FAST_PLAN_MIN_TERMS,
  WEB_QUERY_MAX_CHARS,
} from '../../constants/web';
import { detectQuestionLanguage, scriptLanguagesOf } from '../questionLanguage';
import { extractQueryTerms, hasStopwordCoverage } from '../queryTerms';
import {
  dependsOnConversation,
  extractSiteRestriction,
  hasHardSearchSignal,
  isAboutTheConversation,
  toKeywordQuery,
  withSiteRestriction,
  type WebSearchPlan,
} from './buildSearchQuery';
import type { WebIntentKind } from './intentKind';
import {
  hasNoSearchLexicon,
  lacksSearchSignal,
  namesFreshnessOrLookup,
} from './noSearchSignal';
import {
  hasPriorTurns,
  namesItsOwnSubject,
  topicAnchorer,
} from './topicAnchors';

const PRICE_WORDS =
  /(?<![\p{L}])(?:prices?|costs?|cena|ceny|cen[aeę]|kosztuj\w*|preis\w*|prix|precio\w*|prezzo|prezzi)(?![\p{L}])/iu;
const DATE_PHRASES =
  /(?<![\p{L}])(?:(?:what|which)\s+(?:day|date|year|month)|in\s+what\s+year|on\s+what\s+day|when\s+(?:did|was|is|will|does)|kiedy|w\s+kt[oó]rym\s+roku|kt[oó]rego\s+dnia|welches\s+jahr|wann|quand|cu[aá]ndo|quando)(?![\p{L}])/iu;
const HOWTO_PHRASES =
  /(?<![\p{L}])(?:how\s+(?:to|do\s+i|can\s+i)|jak\s+(?:zrobi[cć]|ugotowa[cć]|naprawi[cć]|zainstalowa[cć]|za[lł]o[zż]y[cć]))(?![\p{L}])/iu;

const CODE_SPANS = /```[\s\S]*?```|`[^`\n]+`/gu;
const WEB_ADDRESS = /https?:\/\/|www\./iu;

const KIND_PATTERNS: [WebIntentKind, RegExp][] = [
  ['price', PRICE_WORDS],
  ['howto', HOWTO_PHRASES],
  ['date', DATE_PHRASES],
];

export const inferIntentKind = (question: string): WebIntentKind | undefined =>
  KIND_PATTERNS.find(([, pattern]) => pattern.test(question))?.[0];

export const mayNeedConversation = (
  query: string,
  history: { role: string; content: string }[]
): boolean =>
  dependsOnConversation(query) ||
  (hasPriorTurns(history) && !namesItsOwnSubject(query));

export const keywordQueryFor = (
  query: string,
  history: { role: string; content: string }[],
  digest?: string
): string => toKeywordQuery(topicAnchorer(query, history, digest)(query));

const lexiconLanguageAmong = (
  query: string,
  candidates: (string | undefined)[]
): string | null => {
  if (!query || isAboutTheConversation(query)) return null;
  return (
    candidates.find(
      (code): code is string => !!code && hasNoSearchLexicon(code)
    ) ?? null
  );
};

const lexiconLanguageOf = (query: string): string | null =>
  lexiconLanguageAmong(query, [detectQuestionLanguage(query)?.code]);

const requestLanguageOf = (query: string): string | null =>
  lexiconLanguageAmong(query, [
    detectQuestionLanguage(query)?.code,
    ...scriptLanguagesOf(query),
  ]);

const carriesLookupSignal = (query: string, language: string): boolean => {
  const prose = query.replace(CODE_SPANS, ' ');
  return (
    hasHardSearchSignal(prose) ||
    WEB_ADDRESS.test(prose) ||
    extractSiteRestriction(prose) !== null ||
    namesFreshnessOrLookup(prose, language)
  );
};

export const isNoSearchRequest = (userInput: string): boolean => {
  const query = userInput.trim();
  const language = requestLanguageOf(query);
  return (
    !!language &&
    lacksSearchSignal(query, language) &&
    !carriesLookupSignal(query, language)
  );
};

export const fastPlanWebSearch = (
  userInput: string,
  history: { role: string; content: string }[],
  opts?: { digest?: string }
): WebSearchPlan | null => {
  const query = userInput.trim();
  const language = lexiconLanguageOf(query);
  if (!language) return null;
  if (lacksSearchSignal(query, language)) return null;
  if (mayNeedConversation(query, history)) return null;
  if (!hasStopwordCoverage(language)) return null;

  const keywordQuery = keywordQueryFor(query, history, opts?.digest);
  if (keywordQuery.length > WEB_QUERY_MAX_CHARS) return null;
  if (
    extractQueryTerms(keywordQuery, language).size < WEB_FAST_PLAN_MIN_TERMS
  ) {
    return null;
  }

  const siteRestriction = extractSiteRestriction(query);
  const kind = inferIntentKind(query);
  return {
    needsSearch: true,
    intent: '',
    ...(kind ? { kind } : {}),
    queries: [withSiteRestriction(keywordQuery, siteRestriction)],
    ...(siteRestriction ? { siteRestriction } : {}),
  };
};
