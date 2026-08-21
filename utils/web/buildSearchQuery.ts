import {
  WEB_QUERY_CONTEXT_TURNS,
  WEB_QUERY_CONTEXT_TURN_MAX_CHARS,
  WEB_QUERY_INTENT_MAX_CHARS,
  WEB_QUERY_MAX_CHARS,
  WEB_QUERY_MAX_SUBQUERIES,
  WEB_QUERY_REWRITE,
} from '../../constants/web';
import { todayISO } from '../todayISO';
import { foldForMatching } from '../queryTerms';

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
  queries: string[];
  siteRestriction?: string;
}

const PLANNER_EXAMPLES: {
  user: string;
  needsSearch: boolean;
  intent: string;
  queries: string[];
}[] = [
  {
    user: "hey, how's it going?",
    needsSearch: false,
    intent: 'casual greeting',
    queries: [],
  },
  {
    user: 'write a short poem about autumn',
    needsSearch: false,
    intent: 'creative writing',
    queries: [],
  },
  {
    user: 'I feel tired, how can I sleep better?',
    needsSearch: false,
    intent: 'personal advice',
    queries: [],
  },
  {
    user: 'python vs javascript, which should a beginner learn?',
    needsSearch: false,
    intent: 'programming language opinion',
    queries: [],
  },
  {
    user: 'whats the weather in tokyo right now',
    needsSearch: true,
    intent: 'current Tokyo weather',
    queries: ['Tokyo weather today'],
  },
  {
    user: 'how much does bitcoin cost right now',
    needsSearch: true,
    intent: 'current bitcoin price',
    queries: ['bitcoin price today'],
  },
  {
    user: 'compare the prices of bitcoin and ethereum',
    needsSearch: true,
    intent: 'compare Bitcoin and Ethereum prices',
    queries: ['bitcoin price today', 'ethereum price today'],
  },
  {
    user: 'which song has been streamed the most on spotify this year',
    needsSearch: true,
    intent: 'most streamed song this year',
    queries: ['most streamed song Spotify 2025'],
  },
];

const PLANNER_EXAMPLES_TEXT = PLANNER_EXAMPLES.map(
  (ex) =>
    `User: ${ex.user}\n` +
    `{"needs_search": ${ex.needsSearch}, "intent": "${ex.intent}", "queries": [${ex.queries
      .map((q) => `"${q}"`)
      .join(', ')}]}\n`
).join('');

const EXAMPLE_LEAK_TOKENS: string[] = [
  ...new Set(
    PLANNER_EXAMPLES.flatMap(
      (ex) => ex.queries.join(' ').match(/\p{Lu}[\p{L}]+/gu) ?? []
    )
  ),
];

const PLANNER_SYSTEM_PROMPT = (today: string): string =>
  "You turn the user's latest message into a web-search plan. " +
  'Output ONLY one JSON object, no other text and no reasoning:\n' +
  '{"needs_search": true|false, "intent": "<goal, max 8 words>", "queries": ["<q1>", "<optional q2>"]}\n' +
  'Set needs_search by what the best answer truly needs, in ANY language:\n' +
  '- false when you can answer well on your own: greetings, thanks, chit-chat, ' +
  'opinions, advice, math, coding, translation, rewriting, or timeless general ' +
  'knowledge. Then "queries": [].\n' +
  '- true only when the best answer needs fresh, local, or verifiable outside ' +
  'facts: current events, news, prices, weather, scores, schedules, releases, ' +
  'specs, or specific people, places or organisations.\n' +
  'If the message is conversational and you are unsure, choose false.\n' +
  'Each query is concise search KEYWORDS under 12 words, not a sentence. ' +
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

const DOMAIN_PATTERN =
  /\b(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,})\b/i;

export const extractSiteRestriction = (userInput: string): string | null => {
  const match = userInput.match(DOMAIN_PATTERN);
  return match ? match[1]!.toLowerCase() : null;
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

  return { needsSearch, intent, queries };
};

const buildConversation = (
  history: { role: string; content: string }[]
): string =>
  history
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

export const planWebSearch = async (
  userInput: string,
  history: { role: string; content: string }[],
  generate: QueryRewriteFn,
  opts?: { today?: string; rewrite?: boolean }
): Promise<WebSearchPlan> => {
  const query = userInput.trim();
  const siteRestriction = extractSiteRestriction(query);
  const verbatim = (intent = ''): WebSearchPlan => ({
    needsSearch: true,
    intent,
    queries: [
      withSiteRestriction(clampQuery(toKeywordQuery(query)), siteRestriction),
    ],
    ...(siteRestriction ? { siteRestriction } : {}),
  });

  if (!query) return { needsSearch: false, intent: '', queries: [] };
  if (!(opts?.rewrite ?? WEB_QUERY_REWRITE)) return verbatim();

  const convo = buildConversation(history);
  const userPrompt = convo
    ? `Conversation so far:\n${convo}\n\nLatest user message: ${query}\n\nJSON plan:`
    : `User message: ${query}\n\nJSON plan:`;

  let raw: string;
  try {
    raw = await generate([
      {
        role: 'system',
        content: PLANNER_SYSTEM_PROMPT(opts?.today ?? todayISO()),
      },
      { role: 'user', content: userPrompt },
    ]);
  } catch {
    return verbatim();
  }

  const parsed = parseSearchPlan(raw);
  if (!parsed) return verbatim();
  if (!parsed.needsSearch) {
    return { needsSearch: false, intent: parsed.intent, queries: [] };
  }

  const today = opts?.today ?? todayISO();
  const groundedText = foldForMatching(`${query} ${convo}`);
  const safeQueries = parsed.queries
    .filter((q) => !isLeakedQuery(q, groundedText))
    .map((q) => regroundYears(q, query, today))
    .map((q) => withSiteRestriction(q, siteRestriction));

  if (safeQueries.length === 0) return verbatim(parsed.intent);
  return {
    ...parsed,
    queries: safeQueries,
    ...(siteRestriction ? { siteRestriction } : {}),
  };
};
