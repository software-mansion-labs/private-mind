import type { ExtractedArticle } from '../types';

export const URL_SOURCE_TYPE = 'url';

export interface UrlSourceDescriptor {
  name: string;
  type: typeof URL_SOURCE_TYPE;
  size: number | null;
}

export const buildUrlSource = (
  url: string,
  article?: Pick<ExtractedArticle, 'title' | 'text'>
): UrlSourceDescriptor => ({
  name: article?.title?.trim() || url,
  type: URL_SOURCE_TYPE,
  size: article?.text ? article.text.length : null,
});
