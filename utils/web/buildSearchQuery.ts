import {
  WEB_QUERY_CONTEXT_TURNS,
  WEB_QUERY_CONTEXT_TURN_MAX_CHARS,
  WEB_QUERY_INTENT_MAX_CHARS,
  WEB_QUERY_MAX_CHARS,
  WEB_QUERY_MAX_SUBQUERIES,
  WEB_QUERY_REWRITE,
} from '../../constants/web';
import { todayISO } from '../todayISO';

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
  `Turn today/latest/now/current into a concrete date or year; today is ${today}. ` +
  'Give 1 query normally, 2 ONLY for a clear comparison of two things.\n' +
  'User: hej, jak leci?\n' +
  '{"needs_search": false, "intent": "casual greeting", "queries": []}\n' +
  'User: napisz krótki wiersz o jesieni\n' +
  '{"needs_search": false, "intent": "creative writing", "queries": []}\n' +
  'User: whats the weather in kraków right now\n' +
  '{"needs_search": true, "intent": "current Kraków weather", "queries": ["Kraków weather today"]}\n' +
  'Those are only format examples — plan for the actual user message below and ' +
  'never copy their words or topics.';

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
  const verbatim = (intent = ''): WebSearchPlan => ({
    needsSearch: true,
    intent,
    queries: [clampQuery(toKeywordQuery(query))],
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
  if (parsed.queries.length === 0) return verbatim(parsed.intent);
  return parsed;
};
