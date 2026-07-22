import { WebViewScrapeProvider } from '../utils/web/scrape/webViewScrapeProvider';
import { SCRAPE_CHALLENGE_TIMEOUT_MS, SCRAPE_ENGINES } from '../constants/web';
import type { WebSearchResult } from '../utils/web/types';

const hit = (url: string): WebSearchResult => ({
  title: 'Result',
  url,
  snippet: '',
});

const attach = (
  provider: WebViewScrapeProvider,
  replies: Record<string, WebSearchResult[] | 'error' | 'silent'>
) => {
  const navigated: string[] = [];
  provider.attachHost({
    navigate: (url: string) => {
      navigated.push(url);
      const engine = SCRAPE_ENGINES.find((candidate) =>
        url.startsWith(candidate.url)
      );
      const reply = replies[engine?.id ?? ''] ?? [];
      if (reply === 'silent') return;
      if (reply === 'error') {
        provider.handleMessage(
          JSON.stringify({ type: 'serp-error', message: 'boom' })
        );
        return;
      }
      provider.handleMessage(
        JSON.stringify({ type: 'serp-results', results: reply })
      );
    },
  });
  return navigated;
};

const settle = async <T>(promise: Promise<T>): Promise<T> => {
  const raced = promise.catch((error) => ({ __error: error }) as never);
  await jest.advanceTimersByTimeAsync(120_000);
  const value = await raced;
  if (value && typeof value === 'object' && '__error' in value) {
    throw (value as { __error: unknown }).__error;
  }
  return value;
};

const engineIds = SCRAPE_ENGINES.map((engine) => engine.id);

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  (console.warn as jest.Mock).mockRestore();
});

describe('WebViewScrapeProvider engine chain', () => {
  it('uses only the primary engine when it returns results', async () => {
    const provider = new WebViewScrapeProvider();
    const navigated = attach(provider, {
      [engineIds[0]!]: [hit('https://a.example/')],
    });
    const seen: string[] = [];

    const results = await settle(
      provider.search('warsaw weather', {
        onEngine: (engine) => seen.push(engine.id),
      })
    );

    expect(results).toEqual([hit('https://a.example/')]);
    expect(navigated).toHaveLength(1);
    expect(seen).toEqual([engineIds[0]]);
  });

  it('falls through to the next engine when the primary finds nothing', async () => {
    const provider = new WebViewScrapeProvider();
    const navigated = attach(provider, {
      [engineIds[0]!]: [],
      [engineIds[1]!]: [hit('https://b.example/')],
    });
    const seen: { id: string; index: number; resultCount: number }[] = [];

    const results = await settle(
      provider.search('warsaw weather', { onEngine: (e) => seen.push(e) })
    );

    expect(results).toEqual([hit('https://b.example/')]);
    expect(navigated).toHaveLength(2);
    expect(navigated[1]).toContain(SCRAPE_ENGINES[1]!.url);
    expect(seen).toEqual([
      { id: engineIds[0], index: 0, resultCount: 0 },
      { id: engineIds[1], index: 1, resultCount: 1 },
    ]);
  });

  it('survives an engine that errors and lets a later one serve the query', async () => {
    const provider = new WebViewScrapeProvider();
    attach(provider, {
      [engineIds[0]!]: 'error',
      [engineIds[1]!]: [],
      [engineIds[2]!]: [hit('https://c.example/')],
    });

    const results = await settle(provider.search('warsaw weather'));

    expect(results).toEqual([hit('https://c.example/')]);
  });

  it('times out an engine that never answers and moves on', async () => {
    const provider = new WebViewScrapeProvider();
    const navigated = attach(provider, {
      [engineIds[0]!]: 'silent',
      [engineIds[1]!]: [hit('https://d.example/')],
    });

    const results = await settle(provider.search('warsaw weather'));

    expect(results).toEqual([hit('https://d.example/')]);
    expect(navigated).toHaveLength(2);
  });

  it('returns an honest empty set when every engine finds nothing', async () => {
    const provider = new WebViewScrapeProvider();
    const navigated = attach(provider, {});

    const results = await settle(provider.search('warsaw weather'));

    expect(results).toEqual([]);
    expect(navigated).toHaveLength(SCRAPE_ENGINES.length);
  });

  it('rethrows when every engine errored, rather than faking an empty SERP', async () => {
    const provider = new WebViewScrapeProvider();
    attach(
      provider,
      Object.fromEntries(engineIds.map((id) => [id, 'error' as const]))
    );

    await expect(settle(provider.search('warsaw weather'))).rejects.toThrow(
      'boom'
    );
  });

  it('stops the chain when the user cancels a bot-wall', async () => {
    const provider = new WebViewScrapeProvider();
    const navigated: string[] = [];
    provider.attachHost({
      navigate: (url: string) => {
        navigated.push(url);
        provider.handleMessage(JSON.stringify({ type: 'serp-challenge' }));
        provider.cancelPending();
      },
    });

    const results = await settle(provider.search('warsaw weather'));

    expect(results).toEqual([]);
    expect(navigated).toHaveLength(1);
  });

  it('honours an already-aborted signal without navigating', async () => {
    const provider = new WebViewScrapeProvider();
    const navigated = attach(provider, {});
    const controller = new AbortController();
    controller.abort();

    const results = await settle(
      provider.search('warsaw weather', { signal: controller.signal })
    );

    expect(results).toEqual([]);
    expect(navigated).toHaveLength(0);
  });

  it('settles a hanging navigation as soon as the signal aborts', async () => {
    const provider = new WebViewScrapeProvider();
    const navigated = attach(provider, {
      [engineIds[0]!]: 'silent',
    });
    const controller = new AbortController();

    const promise = provider.search('warsaw weather', {
      signal: controller.signal,
    });
    await jest.advanceTimersByTimeAsync(0);
    expect(navigated).toHaveLength(1);
    controller.abort();

    expect(await promise).toEqual([]);
    expect(navigated).toHaveLength(1);
  });

  it('fails fast instead of hanging when the host detaches mid-search', async () => {
    const provider = new WebViewScrapeProvider();
    attach(provider, { [engineIds[0]!]: 'silent' });

    const promise = provider.search('warsaw weather');
    await jest.advanceTimersByTimeAsync(0);
    provider.detachHost();

    await expect(settle(promise)).rejects.toThrow('detached');
  });

  it('clears the challenge flag when a challenge times out unanswered', async () => {
    const provider = new WebViewScrapeProvider();
    let calls = 0;
    provider.attachHost({
      navigate: () => {
        calls += 1;
        provider.handleMessage(
          JSON.stringify(
            calls === 1
              ? { type: 'serp-challenge' }
              : { type: 'serp-results', results: [] }
          )
        );
      },
    });

    const promise = provider.search('warsaw weather');
    await jest.advanceTimersByTimeAsync(0);
    expect(provider.isChallengeActive()).toBe(true);

    await jest.advanceTimersByTimeAsync(SCRAPE_CHALLENGE_TIMEOUT_MS);
    expect(provider.isChallengeActive()).toBe(false);

    expect(await settle(promise)).toEqual([]);
  });
});
