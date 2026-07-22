import type { WebContext, WebSearchResult, WebSourceDocument } from './types';
import {
  WEB_CONTENT_MAX_CHARS,
  WEB_SNIPPET_MAX_CHARS,
} from '../../constants/web';
import { sourceBlock } from '../contextUtils';
import { extractQueryTerms, foldForMatching, stemPrefix } from '../queryTerms';

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;

export const hostname = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const PASSAGE_MAX_LEN = 320;
const splitIntoPassages = (text: string): string[] => {
  const sentences = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) ?? [text];
  const passages: string[] = [];
  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s) continue;
    if (s.length <= PASSAGE_MAX_LEN) {
      passages.push(s);
      continue;
    }
    for (let i = 0; i < s.length; i += PASSAGE_MAX_LEN) {
      passages.push(s.slice(i, i + PASSAGE_MAX_LEN).trim());
    }
  }
  return passages.filter(Boolean);
};

const scorePassage = (passage: string, needles: string[]): number => {
  const folded = foldForMatching(passage);
  let score = 0;
  for (const needle of needles) if (folded.includes(needle)) score += 2;
  if (/\d/.test(passage)) score += 1;
  return score;
};

export const selectRelevantContent = (
  content: string,
  query: string | undefined,
  maxChars: number
): string => {
  const trimmed = content.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const needles = query
    ? [
        ...new Set(
          [...extractQueryTerms(query)].map((term) =>
            stemPrefix(foldForMatching(term))
          )
        ),
      ]
    : [];
  if (needles.length === 0) return truncate(trimmed, maxChars);

  const scored = splitIntoPassages(trimmed).map((text, index) => ({
    text,
    index,
    score: scorePassage(text, needles),
  }));
  if (scored.every((passage) => passage.score === 0)) {
    return truncate(trimmed, maxChars);
  }

  let used = 0;
  const chosen = [...scored]
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .filter((passage) => {
      if (passage.score === 0) return false;
      const cost = passage.text.length + 1;
      if (used + cost > maxChars) return false;
      used += cost;
      return true;
    })
    .sort((a, b) => a.index - b.index)
    .map((passage) => passage.text);

  const excerpt = chosen.join(' ');
  return excerpt || truncate(trimmed, maxChars);
};

export const webResultsToContext = (
  results: WebSearchResult[],
  query?: string
): WebContext => {
  const context: string[] = [];
  const sourceDocuments: WebSourceDocument[] = [];

  results.forEach((result, index) => {
    const name = result.title || hostname(result.url);
    const snippet = truncate(result.snippet.trim(), WEB_SNIPPET_MAX_CHARS);
    const relevant = result.content
      ? selectRelevantContent(result.content, query, WEB_CONTENT_MAX_CHARS)
      : '';
    const contextPassage = relevant
      ? snippet
        ? `${snippet}\n${relevant}`
        : relevant
      : snippet;

    context.push(sourceBlock(index, name, contextPassage));

    sourceDocuments.push({
      kind: 'web',
      name,
      url: result.url,
      passage: snippet,
      query: query?.trim() || undefined,
      similarity: results.length > 1 ? 1 - index / results.length : 1,
    });
  });

  return { context, sourceDocuments };
};
