import type { ExtractedArticle, WebSearchResult } from '../types';
import {
  WEB_CACHE_TTL_MS,
  WEB_PAGE_CACHE_MAX_CHARS,
  WEB_SERP_CACHE_MAX_ENTRIES,
} from '../../../constants/web';

interface Entry<T> {
  value: T;
  cost: number;
  expiresAt: number;
}

export class TtlCache<T> {
  private entries = new Map<string, Entry<T>>();
  private cost = 0;

  constructor(
    private readonly maxCost: number,
    private readonly ttlMs: number
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.remove(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, cost = 1): void {
    if (cost > this.maxCost) return;
    this.remove(key);
    this.entries.set(key, { value, cost, expiresAt: Date.now() + this.ttlMs });
    this.cost += cost;
    for (const oldest of this.entries.keys()) {
      if (this.cost <= this.maxCost) break;
      this.remove(oldest);
    }
  }

  clear(): void {
    this.entries.clear();
    this.cost = 0;
  }

  get totalCost(): number {
    return this.cost;
  }

  private remove(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.cost -= entry.cost;
    this.entries.delete(key);
  }
}

export const serpCache = new TtlCache<WebSearchResult[]>(
  WEB_SERP_CACHE_MAX_ENTRIES,
  WEB_CACHE_TTL_MS
);

export const pageCache = new TtlCache<ExtractedArticle>(
  WEB_PAGE_CACHE_MAX_CHARS,
  WEB_CACHE_TTL_MS
);

export const clearWebCaches = (): void => {
  serpCache.clear();
  pageCache.clear();
};
