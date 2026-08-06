import type { WebSearchResult, ExtractedArticle } from './types';
import { extractArticle, looksLikeBotWall } from './url/extractArticle';
import { hostname } from './webResultsToContext';
import {
  WEB_CONTENT_FETCH_TIMEOUT_MS,
  WEB_CONTENT_MIN_CHARS,
  WEB_FETCH_TOP_N_CONTENT,
} from '../../constants/web';

export interface EnrichPageEvent {
  url: string;
  host: string;
  ok: boolean;
}

export type ArticleFetcher = (
  url: string,
  timeoutMs: number,
  signal?: AbortSignal
) => Promise<ExtractedArticle>;

export const enrichWebResults = async (
  results: WebSearchResult[],
  topN: number = WEB_FETCH_TOP_N_CONTENT,
  onPage?: (event: EnrichPageEvent) => void,
  skip?: ReadonlySet<string>,
  fetchArticle: ArticleFetcher = extractArticle,
  signal?: AbortSignal,
  sequential = false
): Promise<WebSearchResult[]> => {
  if (topN <= 0 || results.length === 0) return results;

  const candidates = results.filter(
    (result) => !result.content && !skip?.has(result.url)
  );
  const enrichedByUrl = new Map<string, WebSearchResult>();

  const enrichOne = async (result: WebSearchResult): Promise<boolean> => {
    if (signal?.aborted) return false;
    try {
      const article = await fetchArticle(
        result.url,
        WEB_CONTENT_FETCH_TIMEOUT_MS,
        signal
      );
      const text = article.text?.trim() ?? '';
      const usable =
        text.length >= WEB_CONTENT_MIN_CHARS &&
        !looksLikeBotWall(text, article.title);
      onPage?.({ url: result.url, host: hostname(result.url), ok: usable });
      if (usable) enrichedByUrl.set(result.url, { ...result, content: text });
      return usable;
    } catch {
      onPage?.({ url: result.url, host: hostname(result.url), ok: false });
      return false;
    }
  };

  let index = 0;
  let succeeded = 0;
  while (succeeded < topN && index < candidates.length && !signal?.aborted) {
    const batch = candidates.slice(
      index,
      index + (sequential ? 1 : topN - succeeded)
    );
    index += batch.length;
    const outcomes = await Promise.all(batch.map(enrichOne));
    succeeded += outcomes.filter(Boolean).length;
  }

  return results.map((result) => enrichedByUrl.get(result.url) ?? result);
};
