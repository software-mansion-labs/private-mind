import { TOKEN_PATTERN, extractQueryTerms } from './queryTerms';
import {
  CITATION_ALPHA_TERM_PATTERN,
  CITATION_DOCUMENT_NAME_TOKEN_PATTERN,
  CITATION_EXCERPT_MAX_CHARS,
  CITATION_MIN_MATCH_SCORE,
  CITATION_SENTENCE_PATTERN,
  CITATION_STEM_PREFIX_LENGTH,
} from '../constants/citations';

export { extractQueryTerms };

export interface CitationSpan {
  start: number;
  end: number;
}

interface Sentence {
  text: string;
  start: number;
  end: number;
}

const splitSentences = (passage: string): Sentence[] => {
  const sentences: Sentence[] = [];
  let match: RegExpExecArray | null;

  CITATION_SENTENCE_PATTERN.lastIndex = 0;
  while ((match = CITATION_SENTENCE_PATTERN.exec(passage)) !== null) {
    const raw = match[0];
    if (!raw.trim()) continue;

    const leading = raw.length - raw.trimStart().length;
    const trailing = raw.length - raw.trimEnd().length;
    const start = match.index + leading;
    const end = match.index + raw.length - trailing;
    if (end > start) {
      sentences.push({ text: passage.slice(start, end), start, end });
    }
  }

  return sentences;
};

type TermMatch = 'exact' | 'stem' | 'none';

const matchTermInSentence = (
  lower: string,
  words: string[],
  term: string
): TermMatch => {
  if (lower.includes(term)) return 'exact';
  if (
    term.length < CITATION_STEM_PREFIX_LENGTH ||
    !CITATION_ALPHA_TERM_PATTERN.test(term)
  ) {
    return 'none';
  }
  const prefix = term.slice(0, CITATION_STEM_PREFIX_LENGTH);
  return words.some((word) => word.startsWith(prefix)) ? 'stem' : 'none';
};

export const findCitedSpan = (
  passage: string | undefined,
  query: string
): CitationSpan | null => {
  if (!passage?.trim() || !query.trim()) return null;

  const terms = extractQueryTerms(query);
  if (terms.size === 0) return null;

  const sentences = splitSentences(passage);
  if (sentences.length === 0) return null;

  let best: CitationSpan | null = null;
  let bestScore = 0;
  let bestExact = 0;
  let bestDensity = 0;

  for (const sentence of sentences) {
    const lower = sentence.text.toLowerCase();
    const words = lower.match(TOKEN_PATTERN) ?? [];
    let score = 0;
    let exact = 0;
    for (const term of terms) {
      const match = matchTermInSentence(lower, words, term);
      if (match === 'none') continue;
      score += 1;
      if (match === 'exact') exact += 1;
    }
    if (score === 0) continue;

    const density = score / sentence.text.length;
    if (score > bestScore || (score === bestScore && density > bestDensity)) {
      best = { start: sentence.start, end: sentence.end };
      bestScore = score;
      bestExact = exact;
      bestDensity = density;
    }
  }

  if (bestExact === 0 && bestScore < CITATION_MIN_MATCH_SCORE) return null;

  return best;
};

export const queryNamesDocument = (query: string, name: string): boolean => {
  const base = name.replace(/\.[^.]+$/, '').toLowerCase();
  const tokens = base
    .split(CITATION_DOCUMENT_NAME_TOKEN_PATTERN)
    .filter((token) => token.length >= 3);
  if (tokens.length === 0) return false;

  const lowerQuery = query.toLowerCase();
  return tokens.every((token) => lowerQuery.includes(token));
};

export interface CitationExcerpt {
  text: string;
  span: CitationSpan | null;
}

const cutAtWordBoundary = (text: string, limit: number): number => {
  if (text.length <= limit) return text.length;
  const window = text.slice(0, limit);
  const lastSpace = window.lastIndexOf(' ');
  return lastSpace > limit * 0.6 ? lastSpace : limit;
};

export const buildCitationExcerpt = (
  passage: string | undefined,
  span: CitationSpan | null,
  maxChars = CITATION_EXCERPT_MAX_CHARS
): CitationExcerpt => {
  const source = passage ?? '';

  const hasValidSpan =
    span !== null &&
    span.start >= 0 &&
    span.end <= source.length &&
    span.start < span.end;

  if (!hasValidSpan) {
    if (source.length <= maxChars) return { text: source, span: null };
    const cut = cutAtWordBoundary(source, maxChars);
    return { text: `${source.slice(0, cut).trimEnd()}…`, span: null };
  }

  const { start: citeStart, end: citeEnd } = span!;
  const citedLength = citeEnd - citeStart;

  if (citedLength >= maxChars) {
    const text = source.slice(citeStart, citeEnd);
    return { text, span: { start: 0, end: text.length } };
  }

  const remaining = maxChars - citedLength;
  let start = Math.max(0, citeStart - Math.ceil(remaining / 2));
  let end = Math.min(
    source.length,
    citeEnd + (remaining - (citeStart - start))
  );

  if (start > 0) {
    const nextSpace = source.indexOf(' ', start);
    if (nextSpace !== -1 && nextSpace < citeStart) start = nextSpace + 1;
  }
  if (end < source.length) {
    const prevSpace = source.lastIndexOf(' ', end);
    if (prevSpace > citeEnd) end = prevSpace;
  }

  const prefix = start > 0 ? '…' : '';
  const suffix = end < source.length ? '…' : '';
  const text = `${prefix}${source.slice(start, end)}${suffix}`;
  const relStart = prefix.length + (citeStart - start);

  return { text, span: { start: relStart, end: relStart + citedLength } };
};
