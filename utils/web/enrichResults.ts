import type { WebSearchResult } from './types';
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

export const enrichWebResults = async (
  results: WebSearchResult[],
  topN: number = WEB_FETCH_TOP_N_CONTENT,
  onPage?: (event: EnrichPageEvent) => void,
  skip?: ReadonlySet<string>
): Promise<WebSearchResult[]> => {
  if (topN <= 0 || results.length === 0) return results;

  return Promise.all(
    results.map(async (result, index) => {
      if (index >= topN || result.content || skip?.has(result.url)) {
        return result;
      }
      try {
        const article = await extractArticle(
          result.url,
          WEB_CONTENT_FETCH_TIMEOUT_MS
        );
        const text = article.text?.trim() ?? '';
        const usable =
          text.length >= WEB_CONTENT_MIN_CHARS &&
          !looksLikeBotWall(text, article.title);
        onPage?.({ url: result.url, host: hostname(result.url), ok: usable });
        return usable ? { ...result, content: text } : result;
      } catch {
        onPage?.({ url: result.url, host: hostname(result.url), ok: false });
        return result;
      }
    })
  );
};
