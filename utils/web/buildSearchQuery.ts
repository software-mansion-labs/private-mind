import {
  WEB_QUERY_CONCISE_MAX_WORDS,
  WEB_QUERY_CONTEXT_TURNS,
  WEB_QUERY_CONTEXT_TURN_MAX_CHARS,
  WEB_QUERY_INTENT_MAX_CHARS,
  WEB_QUERY_MAX_CHARS,
  WEB_QUERY_MAX_SUBQUERIES,
  WEB_QUERY_REWRITE,
} from '../../constants/web';

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
}

const PLANNER_SYSTEM_PROMPT = (today: string): string =>
  "You turn the user's latest message into a web-search plan. " +
  'Output ONLY one JSON object, no other text and no reasoning:\n' +
  '{"needs_search": true|false, "intent": "<goal, max 8 words>", "queries": ["<q1>", "<optional q2>"]}\n' +
  'needs_search=false for small talk, opinions, creative writing, or general ' +
  'knowledge with no fresh/real-time facts (then "queries": []). ' +
  'needs_search=true for current events, prices, weather, scores, specs, ' +
  'people/places, or any time-sensitive or factual lookup. ' +
  'Each query is concise search KEYWORDS under 12 words, not a sentence. ' +
  'Resolve pronouns/references (it, that, they) from the conversation. ' +
  `Turn today/latest/now/current into a concrete date or year; today is ${today}. ` +
  'Give 1 query normally, 2 ONLY for a clear comparison of two things.\n' +
  'User: hey how are you\n' +
  '{"needs_search": false, "intent": "casual greeting", "queries": []}\n' +
  'User: whats the weather in kraków right now\n' +
  '{"needs_search": true, "intent": "current Kraków weather", "queries": ["Kraków weather today"]}';

const CONTEXT_MARKERS =
  /\b(it|its|it's|this|that|they|them|those|these|there|he|she|him|her|his|hers|one|ones|instead|too|also|either|another)\b/i;
const FOLLOWUP_START =
  /^(and|or|but|so|then|also|what about|how about|ok|okay)\b/i;

export const isConciseQuery = (text: string): boolean => {
  const t = text.trim();
  if (!t || t.includes('?')) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > WEB_QUERY_CONCISE_MAX_WORDS) return false;
  if (FOLLOWUP_START.test(t)) return false;
  return !CONTEXT_MARKERS.test(t);
};

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

const todayISO = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

export const planWebSearch = async (
  userInput: string,
  history: { role: string; content: string }[],
  generate: QueryRewriteFn,
  opts?: { today?: string }
): Promise<WebSearchPlan> => {
  const query = userInput.trim();
  const verbatim = (intent = ''): WebSearchPlan => ({
    needsSearch: true,
    intent,
    queries: [clampQuery(query)],
  });

  if (!query) return { needsSearch: false, intent: '', queries: [] };
  if (!WEB_QUERY_REWRITE) return verbatim();
  if (isConciseQuery(query)) return verbatim();

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
  if (parsed.queries.length === 0) return verbatim(parsed.intent);
  return parsed;
};
