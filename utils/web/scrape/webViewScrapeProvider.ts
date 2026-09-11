import type {
  WebSearchProvider,
  WebSearchProviderOptions,
  WebSearchResult,
} from '../types';
import { parseSerpMessage } from '../security/untrustedContent';
import {
  SCRAPE_CHALLENGE_TIMEOUT_MS,
  SCRAPE_ENGINES,
  SCRAPE_MIN_DELAY_MS,
  SCRAPE_PAGE_LOAD_TIMEOUT_MS,
  WEB_SEARCH_MAX_RESULTS,
  type ScrapeEngine,
} from '../../../constants/web';

export const searchUrlFor = (
  engine: ScrapeEngine,
  query: string,
  region?: string
): string => {
  const base = `${engine.url}${encodeURIComponent(query)}`;
  if (!region || !engine.regionParam) return base;
  return `${base}&${engine.regionParam}=${encodeURIComponent(region)}`;
};

export interface ScraperHost {
  navigate(url: string, nonce: number): void;
  reset?(): void;
  onChallenge?(): void;
}

type Pending = {
  resolve: (results: WebSearchResult[]) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  nonce: number;
};

export class WebViewScrapeProvider implements WebSearchProvider {
  readonly id = 'webview-scrape';

  private host: ScraperHost | null = null;
  private pending: Pending | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private lastRunAt = 0;
  private navigations = 0;
  private challengeActive = false;
  private cancelled = false;

  cancelPending(): void {
    this.cancelled = true;
    this.settle([], null);
    this.host?.reset?.();
  }

  skipEngine(): void {
    this.settle([], null);
    this.host?.reset?.();
  }

  releaseHost(): void {
    if (this.pending) return;
    this.host?.reset?.();
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
    if (!message || !this.pending || message.nonce !== this.pending.nonce) {
      return;
    }

    if (message.type === 'serp-challenge') {
      if (!this.challengeActive) {
        clearTimeout(this.pending.timer);
        this.pending.timer = setTimeout(() => {
          this.settle([], null);
        }, SCRAPE_CHALLENGE_TIMEOUT_MS);
        this.challengeActive = true;
        this.host?.onChallenge?.();
      }
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
      if (options.signal?.aborted || this.cancelled) break;

      let results: WebSearchResult[] = [];
      try {
        results = await this.navigateAndWait(
          searchUrlFor(engine, query, options.region),
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
    if (this.cancelled) return [];
    this.lastRunAt = nowMs();

    const onAbort = () => {
      this.settle([], null);
      this.host?.reset?.();
    };
    signal?.addEventListener('abort', onAbort);
    try {
      if (signal?.aborted) return [];
      return await new Promise<WebSearchResult[]>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.settle(null, new Error('SERP scrape timed out'));
        }, SCRAPE_PAGE_LOAD_TIMEOUT_MS);

        const nonce = ++this.navigations;
        this.pending = { resolve, reject, timer, nonce };
        this.host!.navigate(url, nonce);
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
