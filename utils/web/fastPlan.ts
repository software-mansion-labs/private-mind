import {
  WEB_FAST_PLAN_MIN_TERMS,
  WEB_QUERY_MAX_CHARS,
} from '../../constants/web';
import { detectQuestionLanguage } from '../questionLanguage';
import { extractQueryTerms, hasStopwordCoverage } from '../queryTerms';
import {
  dependsOnConversation,
  extractSiteRestriction,
  isAboutTheConversation,
  toKeywordQuery,
  withSiteRestriction,
  type WebSearchPlan,
} from './buildSearchQuery';
import type { WebIntentKind } from './intentKind';
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

const POLITE_LEAD =
  /^(?:(?:please|pls|can\s+you|could\s+you|would\s+you|proszę|prosze|czy\s+mo[zż]esz|mo[zż]esz|bitte|kannst\s+du|k[oö]nntest\s+du|por\s+favor|puedes|peux-tu|pouvez-vous|s'il\s+te\s+pla[iî]t)[\s,]+)*/iu;
const TASK_OPENER =
  /^(?:write|translate|rewrite|rephrase|paraphrase|summari[sz]e|proofread|correct|fix|draft|compose|generate|create|calculate|compute|solve|napisz|przet[lł]umacz|przepisz|przeredaguj|zredaguj|sparafrazuj|stre[sś][cć]|podsumuj|popraw|oblicz|policz|rozwi[aą][zż]|stw[oó]rz|wygeneruj|schreib\w*|[uü]bersetz\w*|formulier\w*|korrigier\w*|fasse|berechne\w*|erstell\w*|escrib\w*|traduc\w*|traduz\w*|reescrib\w*|resum\w*|calcul\w*|corrig\w*|[eé]cri[st]\w*|traduis\w*|r[eé][eé]cri\w*|r[eé]sum\w*)(?![\p{L}])/iu;
const TRANSLATION_OR_WRITING =
  /(?:अनुवाद|लिखो|लिखें|लिखिए|ترجمہ|ترجمه|لکھو|لکھیں|ترجم)/u;
const OPINION_OR_ADVICE =
  /(?<![\p{L}])(?:what\s+do\s+you\s+think|your\s+opinion|should\s+i|do\s+you\s+(?:like|prefer)|co\s+my[sś]lisz|czy\s+powin(?:ienem|nam)|jak\s+my[sś]lisz|was\s+(?:denkst|h[aä]ltst)\s+du|sollte\s+ich|qu'en\s+penses-tu|que\s+piensas|deber[ií]a)(?![\p{L}])/iu;
const ARITHMETIC =
  /\p{N}\s*(?:[+*/×÷^=]|\s-\s|\s(?:x|times|razy|mal|plus|minus|divided\s+by|podzielone\s+przez)\s)\s*\p{N}/iu;
const CODE = /```|`[^`\n]+`|\bdef\s+\w+\(|=>|\bfunction\s*\w*\(/u;

const lacksSearchSignal = (query: string): boolean => {
  const request = query.replace(POLITE_LEAD, '');
  return (
    TASK_OPENER.test(request) ||
    TRANSLATION_OR_WRITING.test(query) ||
    OPINION_OR_ADVICE.test(query) ||
    ARITHMETIC.test(query) ||
    CODE.test(query)
  );
};

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

export const fastPlanWebSearch = (
  userInput: string,
  history: { role: string; content: string }[],
  opts?: { digest?: string }
): WebSearchPlan | null => {
  const query = userInput.trim();
  if (!query || isAboutTheConversation(query)) return null;
  if (lacksSearchSignal(query)) return null;
  if (mayNeedConversation(query, history)) return null;

  const language = detectQuestionLanguage(query)?.code;
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
