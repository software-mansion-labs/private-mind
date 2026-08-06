import type { WebSearchResult } from './types';
import { hostname } from './webResultsToContext';

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const BODY_PREFIX_CHARS = 1500;
const BODY_MIN_CHARS = 200;

/* eslint-disable no-bitwise -- FNV-1a is defined in terms of xor and truncation */
const hashText = (text: string): string => {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};
/* eslint-enable no-bitwise */

const normalize = (text: string): string =>
  text.toLowerCase().replace(/\s+/g, ' ').trim();

export const listingFingerprint = (result: WebSearchResult): string | null => {
  const title = normalize(result.title ?? '');
  if (!title) return null;
  return hashText(`${hostname(result.url)}\n${title}`);
};

const bodyFingerprint = (content: string): string | null => {
  const body = normalize(content);
  if (body.length < BODY_MIN_CHARS) return null;
  return hashText(body.slice(0, BODY_PREFIX_CHARS));
};

export const dedupeByBody = (results: WebSearchResult[]): WebSearchResult[] => {
  const seen = new Set<string>();
  return results.filter((result) => {
    const content = result.content?.trim();
    if (!content) return true;
    const body = bodyFingerprint(content);
    if (!body) return true;
    const key = `${hostname(result.url)}\n${body}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
