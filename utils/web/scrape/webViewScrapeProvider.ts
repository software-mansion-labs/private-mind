import type {
  WebSearchProvider,
  WebSearchProviderOptions,
  WebSearchResult,
} from '../types';
import { parseSerpMessage } from './serpParser';
import {
  SCRAPE_CHALLENGE_TIMEOUT_MS,
  SCRAPE_ENGINES,
  SCRAPE_MIN_DELAY_MS,
  SCRAPE_PAGE_LOAD_TIMEOUT_MS,
  WEB_SEARCH_MAX_RESULTS,
} from '../../../constants/web';

export interface ScraperHost {
  navigate(url: string): void;
  onChallenge?(): void;
  recheck?(): void;
}

type Pending = {
  resolve: (results: WebSearchResult[]) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class WebViewScrapeProvider implements WebSearchProvider {
  readonly id = 'webview-scrape';

  private host: ScraperHost | null = null;
  private pending: Pending | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private lastRunAt = 0;
  private challengeActive = false;
  private cancelled = false;

  cancelPending(): void {
    this.cancelled = true;
    this.settle([], null);
  }

  recheck(): void {
    this.host?.recheck?.();
  }

  isChallengeActive(): boolean {
    return this.challengeActive;
  }

  attachHost(host: ScraperHost): void {
    this.host = host;
  }

  detachHost(): void {
    this.host = null;
    this.settle(null, new Error('WebView scraper host detached'));
  }

  isHostAttached(): boolean {
    return this.host !== null;
  }

  isReady(): boolean {
    return this.isHostAttached();
  }

  handleMessage(raw: string): void {
    const message = parseSerpMessage(raw);
    if (!message || !this.pending) return;

    if (message.type === 'serp-challenge') {
      if (this.pending) {
        clearTimeout(this.pending.timer);
        this.pending.timer = setTimeout(() => {
          this.settle([], null);
        }, SCRAPE_CHALLENGE_TIMEOUT_MS);
      }
      this.challengeActive = true;
      this.host?.onChallenge?.();
      return;
    }
    if (message.type === 'serp-error') {
      this.settle(null, new Error(message.message));
      return;
    }
    this.settle(message.results, null);
  }

  async search(
    query: string,
    options: WebSearchProviderOptions = {}
  ): Promise<WebSearchResult[]> {
    const run = this.queue.then(() => this.runThrottled(query, options));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async runThrottled(
    query: string,
    options: WebSearchProviderOptions
  ): Promise<WebSearchResult[]> {
    if (!this.host) throw new Error('WebView scraper host not attached');
    if (options.signal?.aborted) return [];

    this.cancelled = false;
    const max = options.maxResults ?? WEB_SEARCH_MAX_RESULTS;
    let lastError: Error | null = null;

    for (let index = 0; index < SCRAPE_ENGINES.length; index++) {
      const engine = SCRAPE_ENGINES[index]!;
      if (options.signal?.aborted) break;

      let results: WebSearchResult[] = [];
      try {
        results = await this.navigateAndWait(
          `${engine.url}${encodeURIComponent(query)}`,
          options.signal
        );
      } catch (error) {
        lastError = error as Error;
        console.warn(`Web search engine ${engine.id} failed`, error);
      }

      options.onEngine?.({
        id: engine.id,
        index,
        resultCount: results.length,
      });

      if (results.length > 0) return results.slice(0, max);
      if (this.cancelled) return [];
    }

    if (lastError) throw lastError;
    return [];
  }

  private async navigateAndWait(
    url: string,
    signal?: AbortSignal
  ): Promise<WebSearchResult[]> {
    const wait = Math.min(
      SCRAPE_MIN_DELAY_MS,
      SCRAPE_MIN_DELAY_MS - (nowMs() - this.lastRunAt)
    );
    if (wait > 0) await delay(wait);
    if (!this.host) throw new Error('WebView scraper host detached');
    this.lastRunAt = nowMs();

    const onAbort = () => this.settle([], null);
    signal?.addEventListener('abort', onAbort);
    try {
      if (signal?.aborted) return [];
      return await new Promise<WebSearchResult[]>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.settle(null, new Error('SERP scrape timed out'));
        }, SCRAPE_PAGE_LOAD_TIMEOUT_MS);

        this.pending = { resolve, reject, timer };
        this.host!.navigate(url);
      });
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
  }

  private settle(results: WebSearchResult[] | null, error: Error | null): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    this.challengeActive = false;
    clearTimeout(pending.timer);
    if (error) pending.reject(error);
    else pending.resolve(results ?? []);
  }
}

const nowMs = (): number => Date.now();
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const webViewScrapeProvider = new WebViewScrapeProvider();
