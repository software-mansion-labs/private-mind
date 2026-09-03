import type { SourceDocument } from '../../database/chatRepository';

export interface StructuredProduct {
  name?: string;
  price?: string;
  currency?: string;
  availability?: string;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  publishedAt?: string;
  sourceQuery?: string;
  product?: StructuredProduct;
}

export interface ExtractedArticle {
  url: string;
  title: string;
  text: string;
  excerpt?: string;
  byline?: string;
  siteName?: string;
  product?: StructuredProduct;
}

export interface WebSourceDocument extends SourceDocument {
  kind: 'web';
  url: string;
  query?: string;
  used?: boolean;
}

export interface WebContext {
  context: string[];
  sourceDocuments: WebSourceDocument[];
}

export interface WebSearchProviderOptions {
  signal?: AbortSignal;
  maxResults?: number;
  onEngine?: (engine: {
    id: string;
    index: number;
    resultCount: number;
  }) => void;
}

export interface WebSearchProvider {
  readonly id: string;
  search(
    query: string,
    options?: WebSearchProviderOptions
  ): Promise<WebSearchResult[]>;
  isReady?(): boolean;
}
