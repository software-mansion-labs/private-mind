import type { ExtractedArticle } from '../types';
import {
  URL_FETCH_MAX_BYTES,
  URL_FETCH_TIMEOUT_MS,
  URL_FETCH_USER_AGENT,
} from '../../../constants/web';
import { hostname } from '../webResultsToContext';

const stripTagBlock = (html: string, tag: string): string =>
  html.replace(
    new RegExp(`<${tag}\\b[^<]*(?:(?!<\\/${tag}>)<[^<]*)*<\\/${tag}>`, 'gi'),
    ' '
  );

const decodeEntities = (text: string): string =>
  text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const extractTitle = (html: string): string | undefined => {
  const og = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
  );
  if (og?.[1]) return decodeEntities(og[1]).trim();
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title?.[1] ? decodeEntities(title[1]).trim() : undefined;
};

const isolateMainContent = (html: string): string => {
  const article = html.match(/<article\b[\s\S]*?<\/article>/i);
  if (article) return article[0];
  const main = html.match(/<main\b[\s\S]*?<\/main>/i);
  if (main) return main[0];
  const body = html.match(/<body\b[\s\S]*?<\/body>/i);
  return body ? body[0] : html;
};

const heuristicExtractText = (html: string): string => {
  let out = html;
  for (const tag of [
    'script',
    'style',
    'nav',
    'header',
    'footer',
    'aside',
    'form',
    'noscript',
    'svg',
  ]) {
    out = stripTagBlock(out, tag);
  }
  out = isolateMainContent(out);
  return decodeEntities(out.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
};

const BOT_WALL_PHRASES =
  /are you a robot|unusual traffic|verify you are human|verify you're human|checking your browser|enable javascript and cookies|just a moment|attention required|access denied|request blocked|pardon our interruption/i;

const BOT_WALL_MAX_TEXT_CHARS = 800;

export const looksLikeBotWall = (text: string, title?: string): boolean => {
  if (title && BOT_WALL_PHRASES.test(title)) return true;
  return text.length < BOT_WALL_MAX_TEXT_CHARS && BOT_WALL_PHRASES.test(text);
};

export const fetchHtml = async (
  url: string,
  timeoutMs: number = URL_FETCH_TIMEOUT_MS
): Promise<string> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': URL_FETCH_USER_AGENT, 'Accept': 'text/html' },
    });
    if (!response.ok) {
      throw new Error(
        `Fetch failed: ${response.status} ${response.statusText}`
      );
    }
    const html = await response.text();
    return html.length > URL_FETCH_MAX_BYTES
      ? html.slice(0, URL_FETCH_MAX_BYTES)
      : html;
  } finally {
    clearTimeout(timeout);
  }
};

export const extractArticle = async (
  url: string,
  timeoutMs?: number
): Promise<ExtractedArticle> => {
  const html = await fetchHtml(url, timeoutMs);
  const text = heuristicExtractText(html);
  return {
    url,
    title: extractTitle(html) ?? hostname(url),
    text,
    siteName: hostname(url),
  };
};
