import {
  WEB_QUERY_CONTEXT_TURNS,
  WEB_QUERY_CONTEXT_TURN_MAX_CHARS,
  WEB_QUERY_INTENT_MAX_CHARS,
  WEB_QUERY_MAX_CHARS,
  WEB_QUERY_MAX_SUBQUERIES,
  WEB_QUERY_REWRITE,
} from '../../constants/web';
import { todayISO } from '../todayISO';
import { namesAnotherDay } from '../calendarFacts';
import { foldForMatching } from '../queryTerms';
import { conversationSubject, namedEntitiesIn } from './conversationSubject';
import { parseIntentKind, type WebIntentKind } from './intentKind';
import { sharesLanguageWith } from './queryLanguage';
import { topicAnchorer } from './topicAnchors';

export interface QueryRewriteMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type QueryRewriteFn = (
  messages: QueryRewriteMessage[]
) => Promise<string>;

export interface WebSearchPlan {
  needsSearch: boolean;
  intent: string;
  kind?: WebIntentKind;
  queries: string[];
  expects?: string[];
  siteRestriction?: string;
}

const PLANNER_EXAMPLES: {
  user: string;
  needsSearch: boolean;
  intent: string;
  kind: WebIntentKind;
  queries: string[];
  expects?: string[];
}[] = [
  {
    user: "hey, how's it going?",
    needsSearch: false,
    intent: 'casual greeting',
    kind: 'chat',
    queries: [],
  },
  {
    user: 'write a short poem about autumn',
    needsSearch: false,
    intent: 'creative writing',
    kind: 'chat',
    queries: [],
  },
  {
    user: 'I feel tired, how can I sleep better?',
    needsSearch: false,
    intent: 'personal advice',
    kind: 'chat',
    queries: [],
  },
  {
    user: 'python vs javascript, which should a beginner learn?',
    needsSearch: false,
    intent: 'programming language opinion',
    kind: 'chat',
    queries: [],
  },
  {
    user: 'czego dotyczyła ta rozmowa?',
    needsSearch: false,
    intent: 'recap of this conversation',
    kind: 'chat',
    queries: [],
  },
  {
    user: 'was your first answer in polish?',
    needsSearch: false,
    intent: 'about a previous answer',
    kind: 'chat',
    queries: [],
  },
  {
    user: 'whats the weather in tokyo right now',
    needsSearch: true,
    intent: 'current Tokyo weather',
    kind: 'fact',
    queries: ['Tokyo weather today'],
    expects: ['temperature', 'rain or sun'],
  },
  {
    user: 'how much does bitcoin cost right now',
    needsSearch: true,
    intent: 'current bitcoin price',
    kind: 'price',
    queries: ['bitcoin price today'],
    expects: ['price in USD'],
  },
  {
    user: 'compare the prices of bitcoin and ethereum',
    needsSearch: true,
    intent: 'compare Bitcoin and Ethereum prices',
    kind: 'comparison',
    queries: ['bitcoin price today', 'ethereum price today'],
    expects: ['bitcoin price', 'ethereum price'],
  },
  {
    user: 'which song has been streamed the most on spotify this year',
    needsSearch: true,
    intent: 'most streamed song this year',
    kind: 'fact',
    queries: ['most streamed song Spotify 2025'],
  },
  {
    user: 'jaka jest pogoda w Krakowie dzisiaj',
    needsSearch: true,
    intent: 'current Krakow weather',
    kind: 'fact',
    queries: ['pogoda Kraków dzisiaj'],
    expects: ['temperatura', 'opady'],
  },
  {
    user: 'दिल्ली में आज का मौसम कैसा है',
    needsSearch: true,
    intent: 'current Delhi weather',
    kind: 'fact',
    queries: ['दिल्ली मौसम आज'],
  },
];

const quoted = (items: string[]): string =>
  items.map((item) => `"${item}"`).join(', ');

const PLANNER_EXAMPLES_TEXT = PLANNER_EXAMPLES.map(
  (ex) =>
    `User: ${ex.user}\n` +
    `{"needs_search": ${ex.needsSearch}, "intent": "${ex.intent}", "kind": "${ex.kind}", "queries": [${quoted(ex.queries)}], "expects": [${quoted(ex.expects ?? [])}]}\n`
).join('');

const EXAMPLE_LEAK_TOKENS: string[] = [
  ...new Set(
    PLANNER_EXAMPLES.flatMap(
      (ex) =>
        [...ex.queries, ...(ex.expects ?? [])]
          .join(' ')
          .match(/\p{Lu}[\p{L}]+/gu) ?? []
    )
  ),
];

const PLANNER_SYSTEM_PROMPT = (today: string): string =>
  "You turn the user's latest message into a web-search plan. " +
  'Output ONLY one JSON object, no other text and no reasoning:\n' +
  '{"needs_search": true|false, "intent": "<goal, max 8 words>", "kind": "<kind>", "queries": ["<q1>", "<optional q2>"], "expects": ["<what a complete answer must contain>"]}\n' +
  '"expects" names the 1-4 things a complete answer must contain (a value ' +
  "with its unit, a date, a name), each in the user's language; [] when " +
  'needs_search is false.\n' +
  '"kind" is exactly one of: price (an amount of money), specs (technical ' +
  'parameters and figures), comparison (two or more named things side by ' +
  'side), recommendation (which one to choose), news (recent events), date ' +
  '(when something happens or happened), event (a scheduled happening: ' +
  'where and when), place (a location: address, opening hours, contact), ' +
  'person (who someone is or who holds a position), fact (one checkable ' +
  'fact), howto (steps to do something), chat (no search needed).\n' +
  'Set needs_search by what the best answer truly needs, in ANY language:\n' +
  '- false when you can answer well on your own: greetings, thanks, chit-chat, ' +
  'opinions, advice, math, coding, translation, rewriting, or timeless general ' +
  'knowledge. Then "queries": [].\n' +
  '- true only when the best answer needs fresh, local, or verifiable outside ' +
  'facts: current events, news, prices, weather, scores, schedules, releases, ' +
  'specs, a product or model code, who currently holds a position, the ' +
  'current version of something, opening hours or an address, or specific ' +
  'people, places or organisations.\n' +
  'When unsure whether you can answer a specific, checkable question ' +
  'accurately from memory alone, choose true — a search is cheap, a ' +
  'confident wrong or stale answer is not. Only choose false when the ' +
  'message is clearly conversational (greeting, opinion, chit-chat) with ' +
  'nothing to verify.\n' +
  'Each query is concise search KEYWORDS under 12 words, not a sentence. ' +
  "Write every query in the SAME language and script as the user's message. " +
  'Do not translate it — a local question is answered by pages in that ' +
  'language, and the query language is the only signal that reaches them. ' +
  'Use English only when the user wrote in English. ' +
  'Keep the names, places and numbers the user gave, exactly as given; never ' +
  'swap in a related one (a question about the euro is not about the dollar). ' +
  'Use only the latest message and what it refers to — never pull in a name ' +
  'from an earlier, unrelated turn. ' +
  'Resolve pronouns/references (it, that, they) from the conversation. ' +
  `Turn relative time words (today, latest, now, current, this year, this ` +
  `season, so far) into a concrete date, year, or season using today's date ` +
  `— today is ${today}. For a "most/best/top X" question scoped to a recent ` +
  'period, put that concrete year or season in the query itself, so results ' +
  'are about that period and not an all-time or career ranking (a page ' +
  'about "most/best ever" is the wrong answer to a this-year question even ' +
  'when it looks authoritative). ' +
  'Give 1 query normally, one query per item ONLY for a clear comparison of ' +
  '2 or 3 named things (max 3 queries total, even if more things are named).\n' +
  PLANNER_EXAMPLES_TEXT +
  'Those are only format examples — plan for the actual user message below and ' +
  'never copy their words or topics.';

const isLeakedQuery = (query: string, groundedText: string): boolean =>
  EXAMPLE_LEAK_TOKENS.some(
    (token) =>
      foldForMatching(query).includes(foldForMatching(token)) &&
      !groundedText.includes(foldForMatching(token))
  );

const YEAR_RE = /\b(19|20)\d{2}\b/g;

const regroundYears = (
  queryText: string,
  userInput: string,
  today: string
): string => {
  const currentYear = new Date(today).getFullYear();
  if (!Number.isFinite(currentYear)) return queryText;
  return queryText.replace(YEAR_RE, (year) => {
    if (userInput.includes(year)) return year;
    const y = Number(year);
    return y >= currentYear - 1 && y <= currentYear
      ? year
      : String(currentYear);
  });
};

const REQUEST_OPENERS =
  /^(?:\s*(?:proszę|prosze|sprawdź|sprawdz|znajdź|znajdz|poszukaj|wyszukaj|pokaż|pokaz|podaj|powiedz mi|powiedz|napisz|please|check|find|search for|search|show me|show|look up|tell me|give me|get me)(?=[\s,:.\-–—]|$)[\s,:.\-–—]*)+/i;

const QUOTE_CHARS = /["'“”‘’‚„«»]/g;

export const toKeywordQuery = (text: string): string => {
  const cleaned = text
    .replace(REQUEST_OPENERS, '')
    .replace(QUOTE_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || text.trim();
};

const SMALL_TALK_OPENER =
  /^(?:dzi[eę]ki|dzi[eę]kuj[eę]|thanks|thank you|thx|ok|okej|okay|spoko|super|[śs]wietnie|great|nice|cool|perfect|hej|cze[śs][ćc]|siema|witaj|hello|hi|yo|dobra|pa|bye|do widzenia|dobranoc|good night)(?![\p{L}\p{N}])/iu;
const SMALL_TALK_MAX_WORDS = 6;
const CAPITALISED = /^[\p{Lu}\p{Lt}]/u;
const ANY_DIGIT = /\p{N}/u;

export const isSmallTalk = (question: string): boolean => {
  const text = question.trim();
  if (!text || !SMALL_TALK_OPENER.test(text)) return false;
  if (ANY_DIGIT.test(text) || text.includes('?')) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > SMALL_TALK_MAX_WORDS) return false;
  return !words.slice(1).some((word) => CAPITALISED.test(word));
};

const WEB_MAX_BASE_QUERIES = 4;

export const dedupeQueries = (queries: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const candidate of queries) {
    const text = candidate.trim();
    if (!text) continue;
    const key = foldForMatching(text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out.slice(0, WEB_MAX_BASE_QUERIES);
};

export const verbatimQueryFor = (
  question: string,
  planned: string[]
): string | null => {
  const text = toKeywordQuery(question).trim();
  if (!text) return null;
  const key = foldForMatching(text);
  return planned.some((query) => foldForMatching(query.trim()) === key)
    ? null
    : text;
};

const DOMAIN_PATTERN =
  /\b(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.([a-z]{2,}))\b/i;

const KNOWN_TLDS = new Set([
  'com',
  'org',
  'net',
  'edu',
  'gov',
  'int',
  'info',
  'biz',
  'name',
  'io',
  'ai',
  'dev',
  'app',
  'co',
  'me',
  'tv',
  'cc',
  'xyz',
  'shop',
  'store',
  'online',
  'site',
  'cloud',
  'tech',
  'news',
  'blog',
  'eu',
  'pl',
  'de',
  'at',
  'ch',
  'uk',
  'ie',
  'fr',
  'es',
  'pt',
  'it',
  'nl',
  'be',
  'lu',
  'dk',
  'se',
  'no',
  'fi',
  'is',
  'cz',
  'sk',
  'hu',
  'ro',
  'bg',
  'hr',
  'si',
  'gr',
  'tr',
  'ua',
  'ru',
  'by',
  'lt',
  'lv',
  'ee',
  'us',
  'ca',
  'mx',
  'br',
  'ar',
  'cl',
  'au',
  'nz',
  'in',
  'jp',
  'cn',
  'kr',
  'sg',
  'hk',
  'tw',
  'za',
  'ae',
  'il',
]);

export const extractSiteRestriction = (userInput: string): string | null => {
  const match = userInput.match(DOMAIN_PATTERN);
  if (!match) return null;
  return KNOWN_TLDS.has(match[2]!.toLowerCase())
    ? match[1]!.toLowerCase()
    : null;
};

const withSiteRestriction = (query: string, domain: string | null): string =>
  domain && !query.toLowerCase().includes(`site:${domain}`)
    ? `${query} site:${domain}`
    : query;

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;

const clampQuery = (text: string): string => {
  if (text.length <= WEB_QUERY_MAX_CHARS) return text;
  const cut = text.slice(0, WEB_QUERY_MAX_CHARS);
  const space = cut.lastIndexOf(' ');
  return (space > 0 ? cut.slice(0, space) : cut).trim();
};

const stripThink = (text: string): string =>
  text.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, ' ');

export const extractJsonObject = (
  raw: string
): Record<string, unknown> | null => {
  if (!raw) return null;
  const stripped = stripThink(raw);
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const obj: unknown = JSON.parse(stripped.slice(start, end + 1));
    if (!obj || typeof obj !== 'object') return null;
    return obj as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const sanitizeSearchQuery = (raw: string): string => {
  if (!raw) return '';
  let q = stripThink(raw);
  q = (
    q
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? ''
  ).trim();
  q = q.replace(
    /^(the\s+)?(standalone\s+)?(web\s+)?(search\s+)?(query|question)\s*[:-]\s*/i,
    ''
  );
  q = q.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  if (!q || q.length > WEB_QUERY_MAX_CHARS) return '';
  return q;
};

export const parseSearchPlan = (raw: string): WebSearchPlan | null => {
  const obj = extractJsonObject(raw);
  if (!obj) return null;

  const needsSearch = obj.needs_search !== false;
  const intent =
    typeof obj.intent === 'string'
      ? truncate(obj.intent.trim(), WEB_QUERY_INTENT_MAX_CHARS)
      : '';
  const rawQueries: unknown[] = Array.isArray(obj.queries)
    ? obj.queries
    : typeof obj.queries === 'string'
      ? [obj.queries]
      : [];
  const queries = rawQueries
    .map((q) => (typeof q === 'string' ? sanitizeSearchQuery(q) : ''))
    .filter(Boolean)
    .slice(0, WEB_QUERY_MAX_SUBQUERIES);

  const kind = parseIntentKind(obj.kind);
  const expects = parseExpects(obj.expects);
  return {
    needsSearch,
    intent,
    ...(kind ? { kind } : {}),
    queries,
    ...(expects.length > 0 ? { expects } : {}),
  };
};

const EXPECTS_MAX_ITEMS = 4;
const EXPECTS_MAX_CHARS = 40;

const parseExpects = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const text = truncate(item.replace(/\s+/g, ' ').trim(), EXPECTS_MAX_CHARS);
    const key = foldForMatching(text);
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length === EXPECTS_MAX_ITEMS) break;
  }
  return out;
};

const REFERENT_ROLE_MARKERS =
  /\b(prezydent\w*|premier\w*|kr[oó]l\w*|papie[żz]\w*|prezes\w*|szef\w*|dyrektor\w*|the president|the prime minister|the king|the pope|the ceo|the boss)\b/iu;
const PRONOUN_MARKERS =
  /(?<![\p{L}\p{N}])(?:on|ona|ono|jego|jemu|niego|niej|nim|ni[ąa]|nich|jej|go|j[ąa]|ich|im|he|she|it|its|him|her|his|hers|they|them|their)(?![\p{L}\p{N}])/iu;
const NEEDS_REFERENT = new RegExp(
  `${REFERENT_ROLE_MARKERS.source}|${PRONOUN_MARKERS.source}`,
  'iu'
);

const hasOwnEntity = (text: string): boolean =>
  namedEntitiesIn(text).length > 0;

const SHORT_QUERY_MAX_WORDS = 6;
const ELIDED_SUBJECT_MAX_WORDS = 8;
const REFLEXIVE_DROPPED_SUBJECT = /(?<![\p{L}\p{N}])się(?![\p{L}\p{N}])/iu;

const wordCount = (text: string): number =>
  (text.trim().match(/\S+/gu) ?? []).length;

const looksLikeDroppedSubject = (query: string): boolean =>
  wordCount(query) <= SHORT_QUERY_MAX_WORDS &&
  REFLEXIVE_DROPPED_SUBJECT.test(query);

const DEMONSTRATIVE_MARKERS =
  /(?<![\p{L}\p{N}])(?:tego|tej|tym|tych|tamt\w+|je|ich|that|those|these)(?![\p{L}\p{N}])/giu;
const TIME_NOUN_AFTER_DEMONSTRATIVE =
  /^\s*(?:tygodni\w*|miesi[\u0105a]c\w*|rok\w*|roku|sezon\w*|dni\w*|week|month|year|season|day)/iu;
const DEMONSTRATIVE_LOOKAHEAD_CHARS = 14;

const hasAnaphoricReference = (query: string): boolean => {
  for (const match of query.matchAll(DEMONSTRATIVE_MARKERS)) {
    const after = query.slice(
      match.index! + match[0].length,
      match.index! + match[0].length + DEMONSTRATIVE_LOOKAHEAD_CHARS
    );
    if (!TIME_NOUN_AFTER_DEMONSTRATIVE.test(after)) return true;
  }
  return false;
};

const ELIDED_POSSESSOR =
  /(?<![\p{L}])(?:jaki\w*|jaka|jakie|ile|co|kt[o\u00f3]r\w*)\s+(?:ma|maj[\u0105a]|posiada)(?![\p{L}])/iu;
const ELIDED_COPULA = /^\s*(?:a\s+)?czy\s+(?:jest|s[\u0105a])(?![\p{L}])/iu;

const looksLikeElidedSubject = (query: string): boolean =>
  wordCount(query) <= ELIDED_SUBJECT_MAX_WORDS &&
  (ELIDED_POSSESSOR.test(query) || ELIDED_COPULA.test(query));

// A bare-role or pronoun follow-up ("how many kids does the president
// have", "ile dzieci ma prezydent") searches badly on its own — verbatim
// mode has no LLM step to resolve who "the president" is, so without this
// the query goes out under-specified and retrieval comes back generic.
// Splices in the most recently named entity from the conversation so far,
// when the query doesn't already name someone itself.
const TEMPORAL_FOLLOW_UP_MAX_WORDS = 4;

const looksLikeTemporalFollowUp = (query: string): boolean => {
  const words = query.trim().split(/\s+/).filter(Boolean);
  return (
    words.length > 0 &&
    words.length <= TEMPORAL_FOLLOW_UP_MAX_WORDS &&
    namesAnotherDay(query)
  );
};

export const carryReferentIntoQuery = (
  query: string,
  history: { role: string; content: string }[],
  digest?: string
): string => {
  const looksIncomplete =
    NEEDS_REFERENT.test(query) ||
    looksLikeDroppedSubject(query) ||
    hasAnaphoricReference(query) ||
    looksLikeElidedSubject(query) ||
    looksLikeTemporalFollowUp(query);
  if (!looksIncomplete || hasOwnEntity(query)) return query;
  const subject = conversationSubject(history);
  if (subject) return `${query} ${subject}`;
  return digest?.trim() ? `${query} ${digest.trim()}` : query;
};

const CONVERSATIONAL_INTENT_MARKERS =
  /\b(greet\w*|hello|hi there|thank\w*|chit.?chat|small talk|casual|opinion|advice|\bmath\b|coding|programming|\bcode\b|translat\w*|rewrit\w*|paraphras\w*|creative writing|\bpoem\w*|poetry|\bstory\b|\bjoke\w*|recipe idea|general knowledge|timeless|recap|summar\w*|conversation|chat history|(?:previous|earlier|last|first) (?:answer|reply|message|response)s?)\b/i;

const CODE_TOKEN =
  /(?<![\p{L}\p{N}])(?=[\p{L}\p{N}-]*\p{N})(?=[\p{L}\p{N}-]*\p{L})[\p{L}\p{N}-]{3,}(?![\p{L}\p{N}])/u;
const LONG_NUMBER = /(?<![\p{L}\p{N}])\p{N}{3,}(?![\p{L}\p{N}])/u;

export const hasHardSearchSignal = (query: string): boolean =>
  CODE_TOKEN.test(query) || LONG_NUMBER.test(query);

export const isConversationalIntent = (intent: string): boolean =>
  !!intent.trim() && CONVERSATIONAL_INTENT_MARKERS.test(intent);

const buildConversation = (
  history: { role: string; content: string }[],
  digest?: string
): string => {
  const turns = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .filter((m) => m.content.trim())
    .slice(-WEB_QUERY_CONTEXT_TURNS)
    .map(
      (m) =>
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${truncate(
          m.content.trim(),
          WEB_QUERY_CONTEXT_TURN_MAX_CHARS
        )}`
    )
    .join('\n');
  const digestLine = digest?.trim()
    ? `Conversation summary so far: ${digest.trim()}`
    : '';
  return [digestLine, turns].filter(Boolean).join('\n');
};

const ABOUT_THE_CONVERSATION =
  /(?<![\p{L}])(?:podsumuj\w*|streszcz\w*|czego\s+si[eę]\s+dowiedzia\w*|co\s+ustalili[sś]my|powt[oó]rz\s+co|summari[sz]e|summar(?:y|ise)|recap|what\s+(?:have\s+)?(?:we|i)\s+(?:just\s+)?(?:learn|discussed|covered|said)\w*|to\s+sum\s+up)(?![\p{L}])/iu;

export const isAboutTheConversation = (query: string): boolean =>
  ABOUT_THE_CONVERSATION.test(query);

const LANGUAGE_CORRECTION =
  'Every query must be written in the same language and script as the latest user message, not translated. Output only the corrected JSON plan.';

const languageReferenceFor = (
  query: string,
  history: { role: string; content: string }[],
  digest?: string
): string =>
  [
    query,
    digest ?? '',
    ...history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => m.content),
  ].join('\n');

const inConversationLanguage = (
  plan: WebSearchPlan,
  reference: string
): boolean => plan.queries.every((q) => sharesLanguageWith(q, reference));

const replanInConversationLanguage = async (
  messages: QueryRewriteMessage[],
  raw: string,
  generate: QueryRewriteFn,
  reference: string
): Promise<WebSearchPlan | null> => {
  let corrected: string;
  try {
    corrected = await generate([
      ...messages,
      { role: 'assistant', content: raw },
      { role: 'user', content: LANGUAGE_CORRECTION },
    ]);
  } catch {
    return null;
  }
  const plan = parseSearchPlan(corrected);
  if (!plan?.needsSearch || plan.queries.length === 0) return null;
  return inConversationLanguage(plan, reference) ? plan : null;
};

export const planWebSearch = async (
  userInput: string,
  history: { role: string; content: string }[],
  generate: QueryRewriteFn,
  opts?: { today?: string; rewrite?: boolean; digest?: string }
): Promise<WebSearchPlan> => {
  const query = userInput.trim();
  if (isAboutTheConversation(query)) {
    return {
      needsSearch: false,
      intent: 'recap of this conversation',
      queries: [],
    };
  }
  const siteRestriction = extractSiteRestriction(query);
  const anchorTopic = topicAnchorer(query, history, opts?.digest);
  const searchQuery = anchorTopic(
    carryReferentIntoQuery(query, history, opts?.digest)
  );
  const verbatim = (intent = '', kind?: WebIntentKind): WebSearchPlan => ({
    needsSearch: true,
    intent,
    ...(kind ? { kind } : {}),
    queries: [
      withSiteRestriction(
        clampQuery(toKeywordQuery(searchQuery)),
        siteRestriction
      ),
    ],
    ...(siteRestriction ? { siteRestriction } : {}),
  });

  if (!query) return { needsSearch: false, intent: '', queries: [] };
  if (!(opts?.rewrite ?? WEB_QUERY_REWRITE)) return verbatim();

  const convo = buildConversation(history, opts?.digest);
  const userPrompt = convo
    ? `Conversation so far:\n${convo}\n\nLatest user message: ${query}\n\nJSON plan:`
    : `User message: ${query}\n\nJSON plan:`;

  const messages: QueryRewriteMessage[] = [
    {
      role: 'system',
      content: PLANNER_SYSTEM_PROMPT(opts?.today ?? todayISO()),
    },
    { role: 'user', content: userPrompt },
  ];
  let raw: string;
  try {
    raw = await generate(messages);
  } catch {
    return verbatim();
  }

  const parsed = parseSearchPlan(raw);
  if (!parsed) return verbatim();
  if (!parsed.needsSearch) {
    if (hasHardSearchSignal(query)) return verbatim(parsed.intent, parsed.kind);
    return isConversationalIntent(parsed.intent)
      ? { needsSearch: false, intent: parsed.intent, queries: [] }
      : verbatim(parsed.intent);
  }

  const reference = languageReferenceFor(query, history, opts?.digest);
  const plan = inConversationLanguage(parsed, reference)
    ? parsed
    : ((await replanInConversationLanguage(
        messages,
        raw,
        generate,
        reference
      )) ?? {
        ...parsed,
        queries: parsed.queries.filter((q) => sharesLanguageWith(q, reference)),
      });

  const today = opts?.today ?? todayISO();
  const groundedText = foldForMatching(`${query} ${convo}`);
  const safeQueries = plan.queries
    .filter((q) => !isLeakedQuery(q, groundedText))
    .map((q) => regroundYears(q, query, today))
    // The planner is told to "resolve pronouns/references from the
    // conversation," but a small model doesn't reliably do that itself —
    // this is the same under-specified-follow-up gap the verbatim path
    // has, just reached via a query the LLM did produce rather than one
    // it failed to.
    .map((q) => carryReferentIntoQuery(q, history, opts?.digest))
    .map(anchorTopic)
    .map((q) => withSiteRestriction(q, siteRestriction));

  if (safeQueries.length === 0) return verbatim(plan.intent, plan.kind);
  const expects = (plan.expects ?? []).filter(
    (item) => !isLeakedQuery(item, groundedText)
  );
  return {
    ...plan,
    queries: safeQueries,
    ...(expects.length > 0 ? { expects } : { expects: undefined }),
    ...(siteRestriction ? { siteRestriction } : {}),
  };
};
