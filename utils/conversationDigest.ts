import {
  namedEntitiesIn,
  type QueryRewriteFn,
  type QueryRewriteMessage,
} from './web/buildSearchQuery';
import { parseThinkingContent, stripThinkBlocks } from './thinking';
import { foldForMatching } from './queryTerms';

export const DIGEST_MAX_CHARS = 200;

const DIGEST_SYSTEM_PROMPT =
  'You track what a conversation is currently about, so a later follow-up ' +
  'question can be understood on its own. Given the previous topic (if any) ' +
  'and the latest exchange, write the updated topic as a short noun phrase ' +
  'of at most 12 words, in the same language as the conversation, naming ' +
  'the subject and any key entities (people, products, places) still ' +
  'relevant. It must read like a search phrase, not like a sentence about ' +
  'the user: write "parzenie kawy w kawiarce, stopien zmielenia", never ' +
  '"The user is asking about...". Output ONLY that phrase — no labels, no ' +
  'quotes, no reasoning, no commentary.';

export const buildDigestPrompt = (
  previousDigest: string | null,
  question: string,
  answer: string
): QueryRewriteMessage[] => [
  { role: 'system', content: DIGEST_SYSTEM_PROMPT },
  {
    role: 'user',
    content:
      `Previous topic: ${previousDigest?.trim() || 'none yet'}\n\n` +
      `Latest exchange:\nUser: ${question}\nAssistant: ${answer}\n\n` +
      'Updated topic:',
  },
];

const ECHO_LEAD_WORDS = 8;
const ECHO_COVERAGE_RATIO = 0.6;

export const visibleDigestText = (raw: string): string => {
  const visible = stripThinkBlocks(raw);
  if (visible) return visible;
  const parsed = parseThinkingContent(raw);
  if (parsed.hasThinking && parsed.isThinkingComplete === false) {
    const unterminated = (parsed.thinkingContent ?? '').trim();
    if (unterminated.length <= DIGEST_MAX_CHARS) return unterminated;
  }
  return '';
};

const normalizeForEcho = (text: string): string =>
  foldForMatching(text)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const looksLikeAnswerEcho = (
  digest: string,
  answer: string
): boolean => {
  const summary = normalizeForEcho(digest);
  const source = normalizeForEcho(stripThinkBlocks(answer));
  if (!summary || !source) return false;
  if (
    source.includes(summary) &&
    summary.length / source.length >= ECHO_COVERAGE_RATIO
  ) {
    return true;
  }
  const summaryWords = summary.split(' ');
  if (summaryWords.length < ECHO_LEAD_WORDS) return false;
  return (
    summaryWords.slice(0, ECHO_LEAD_WORDS).join(' ') ===
    source.split(' ').slice(0, ECHO_LEAD_WORDS).join(' ')
  );
};

const META_FRAME =
  /^\s*(?:the\s+)?(?:user|conversation|discussion|topic|assistant)\b[^.:]{0,60}?\b(?:is|was|are|about|asking|asks|wants|asked|discussing)\b[^.:]{0,30}?(?:about|is|:)\s*/i;
const META_TAIL = /\s*(?:the\s+)?key entities?\b[^.]*\.?\s*$/i;

export const stripMetaFrame = (text: string): string => {
  const withoutTail = text.replace(META_TAIL, '').trim() || text.trim();
  const cleaned = withoutTail.replace(META_FRAME, '').trim() || withoutTail;
  return cleaned.replace(/^["'“”]+|["'“”]+$/g, '').trim() || text.trim();
};

const keepsMoreSubject = (
  previousDigest: string | null,
  fallback: string
): boolean =>
  !!previousDigest?.trim() &&
  namedEntitiesIn(fallback).length === 0 &&
  namedEntitiesIn(previousDigest).length > 0;

const clampDigest = (text: string): string =>
  text.length <= DIGEST_MAX_CHARS
    ? text
    : `${text.slice(0, DIGEST_MAX_CHARS).trimEnd()}…`;

export const updateConversationDigest = async (
  generate: QueryRewriteFn,
  previousDigest: string | null,
  question: string,
  answer: string
): Promise<string> => {
  if (!question.trim() || !answer.trim()) return previousDigest ?? '';
  try {
    const raw = await generate(
      buildDigestPrompt(previousDigest, question, answer)
    );
    const trimmed = visibleDigestText(raw);
    if (!trimmed) return previousDigest ?? '';
    if (!looksLikeAnswerEcho(trimmed, answer)) {
      return clampDigest(stripMetaFrame(trimmed));
    }
    const fallback = clampDigest(question.trim());
    return keepsMoreSubject(previousDigest, fallback)
      ? previousDigest!
      : fallback;
  } catch {
    return previousDigest ?? '';
  }
};
