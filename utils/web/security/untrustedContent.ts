import type { WebSearchResult } from '../types';
import { isHttpUrl } from './outboundFetch';

export type SerpMessage =
  | { type: 'serp-results'; results: WebSearchResult[] }
  | { type: 'serp-challenge' }
  | { type: 'serp-error'; message: string };

const SERP_HARD_MAX_RESULTS = 20;
const SERP_MAX_URL_CHARS = 2048;
const SERP_MAX_TITLE_CHARS = 300;
const SERP_MAX_SNIPPET_CHARS = 1000;
const SERP_MAX_MESSAGE_CHARS = 512 * 1024;

const collapseWhitespace = (text: string): string =>
  text.replace(/\s+/g, ' ').trim();

const isWebSearchResult = (value: unknown): value is WebSearchResult => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.url === 'string' &&
    isHttpUrl(record.url) &&
    typeof record.title === 'string'
  );
};

const sanitizeResult = (result: WebSearchResult): WebSearchResult => ({
  title: collapseWhitespace(result.title).slice(0, SERP_MAX_TITLE_CHARS),
  url: result.url.slice(0, SERP_MAX_URL_CHARS),
  snippet:
    typeof result.snippet === 'string'
      ? result.snippet.slice(0, SERP_MAX_SNIPPET_CHARS)
      : '',
});

export const parseSerpMessage = (raw: string): SerpMessage | null => {
  if (typeof raw !== 'string' || raw.length > SERP_MAX_MESSAGE_CHARS) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as {
      type?: string;
      results?: unknown;
      message?: unknown;
    };
    if (parsed.type === 'serp-challenge') return { type: 'serp-challenge' };
    if (parsed.type === 'serp-error') {
      return { type: 'serp-error', message: String(parsed.message) };
    }
    if (parsed.type === 'serp-results') {
      const results = Array.isArray(parsed.results)
        ? parsed.results
            .filter(isWebSearchResult)
            .slice(0, SERP_HARD_MAX_RESULTS)
            .map(sanitizeResult)
        : [];
      return { type: 'serp-results', results };
    }
    return null;
  } catch {
    return null;
  }
};

export const neutralizeDelimiters = (text: string): string =>
  text.replace(/-{3,}/g, '—');
