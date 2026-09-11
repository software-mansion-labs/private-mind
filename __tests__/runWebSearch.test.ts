import type { WebSearchResult } from '../utils/web/types';
import type { WebSearchProvider } from '../utils/web/types';
import type { LFMEmbeddings } from '../utils/lfmEmbeddings';

jest.mock('react-native-rag', () => ({
  RecursiveCharacterTextSplitter: jest
    .fn()
    .mockImplementation(({ chunkSize }: { chunkSize: number }) => ({
      splitText: jest.fn(async (text: string) => {
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += chunkSize) {
          chunks.push(text.slice(i, i + chunkSize));
        }
        return chunks;
      }),
    })),
}));

jest.mock('../utils/web/url/extractArticle', () => ({
  ...jest.requireActual('../utils/web/url/extractArticle'),
  extractArticle: jest.fn(),
}));

import { runWebSearch } from '../utils/web/runWebSearch';
import type { WebSearchProgressEvent } from '../utils/web/runWebSearch';
import { extractArticle } from '../utils/web/url/extractArticle';
import { clearWebCaches } from '../utils/web/cache/webCache';
import { WEB_SEARCH_MAX_RESULTS } from '../constants/web';

const axisOf = (text: string): number[] => {
  const lower = text.toLowerCase();
  const weather = /weather|pogoda|temperature/.test(lower) ? 1 : 0;
  const sport = /football|match|score/.test(lower) ? 1 : 0;
  const filler = weather || sport ? 0.1 : 1;
  return [weather, sport, filler];
};
const fakeEmbeddings = {
  embedQuery: jest.fn(async (t: string) => axisOf(t)),
  embedDocument: jest.fn(async (t: string) => axisOf(t)),
  runWithLoadedModel: jest.fn(<T>(operation: () => Promise<T>) => operation()),
} as unknown as LFMEmbeddings;

class MockProvider implements WebSearchProvider {
  readonly id = 'mock';
  calls: string[] = [];
  constructor(
    private readonly map: Record<string, WebSearchResult[]>,
    private readonly ready = true
  ) {}
  isReady() {
    return this.ready;
  }
  async search(query: string): Promise<WebSearchResult[]> {
    this.calls.push(query);
    return (this.map[query] ?? []).slice(0, WEB_SEARCH_MAX_RESULTS);
  }
}

const weatherPage = (url: string): WebSearchResult => ({
  title: 'Warsaw weather',
  url,
  snippet: 'Warsaw weather today',
  content:
    'Warsaw weather today: 21C, sunny, light wind, temperature high. '.repeat(
      12
    ),
});
const sportPage = (url: string): WebSearchResult => ({
  title: 'Football',
  url,
  snippet: 'Football recap',
  content:
    'Football match score last night in the league recap report. '.repeat(12),
});

const WEATHER_TEXT =
  'Warsaw weather today: 21C, sunny, light wind, temperature high. '.repeat(12);
const SPORT_TEXT =
  'Football match score last night in the league recap report. '.repeat(12);

const PHONE_TEXT =
  'Samsung Galaxy S25 price and specifications, display, battery and camera. '.repeat(
    12
  );

const bareResult = (url: string): WebSearchResult => ({
  title: url,
  url,
  snippet: 'snippet',
});

const noGen = async () => '';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => (console.warn as jest.Mock).mockRestore());

describe('runWebSearch', () => {
  it('gates out messages the planner marks needs_search=false', async () => {
    const provider = new MockProvider({});
    const out = await runWebSearch({
      query: 'is the sky blue?',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: async () =>
        '{"needs_search": false, "intent": "general knowledge", "queries": []}',
      today: '2026-07-20',
    });
    expect(out.context).toEqual([]);
    expect(out.telemetry.skippedReason).toBe('gated');
    expect(provider.calls).toHaveLength(0);
  });

  it('gates small talk before the planner is ever asked', async () => {
    const provider = new MockProvider({});
    const generate = jest.fn(async () => '');
    const out = await runWebSearch({
      query: 'Dzieki, to bardzo pomocne.',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate,
      today: '2026-07-20',
    });
    expect(out.telemetry.skippedReason).toBe('gated');
    expect(generate).not.toHaveBeenCalled();
    expect(provider.calls).toHaveLength(0);
  });

  it('skips when the provider is not ready', async () => {
    const provider = new MockProvider({}, false);
    const out = await runWebSearch({
      query: 'warsaw weather',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: noGen,
      today: '2026-07-20',
    });
    expect(out.telemetry.skippedReason).toBe('provider-not-ready');
    expect(provider.calls).toHaveLength(0);
  });

  it('never fetches a result written in another script than the question (live-found)', async () => {
    const provider = new MockProvider({
      'warsaw weather': [
        {
          title: 'الطقس في وارسو اليوم ودرجات الحرارة',
          url: 'https://arabic.example/1',
          snippet: 'توقعات الطقس في وارسو لهذا اليوم مع درجات الحرارة',
        },
        weatherPage('https://weather.example/1'),
      ],
    });
    const out = await runWebSearch({
      query: 'warsaw weather',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: noGen,
      today: '2026-07-20',
    });
    expect(out.sourceDocuments.map((doc) => doc.url)).toEqual([
      'https://weather.example/1',
    ]);
    expect(out.context.join(' ')).not.toContain('وارسو');
  });

  it('runs one round and reports it on strong retrieval', async () => {
    const provider = new MockProvider({
      'warsaw weather': [weatherPage('https://weather.example/1')],
    });
    const events: WebSearchProgressEvent[] = [];
    const out = await runWebSearch({
      query: 'warsaw weather',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: noGen,
      onProgress: (e) => events.push(e),
      today: '2026-07-20',
    });
    expect(out.telemetry.providerCalls).toBe(1);
    expect(out.telemetry.rounds).toHaveLength(1);
    expect(out.context.join('\n')).toContain('weather');
    expect(events.some((e) => e.type === 'searching')).toBe(true);
    expect(events.some((e) => e.type === 'done')).toBe(true);
    expect(events.some((e) => e.type === 'weak')).toBe(false);
  });

  it('logs the plan it is about to run, kind included, so a device session can grade the planner (S8.4)', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const provider = new MockProvider({
      'jaka jest dzisiaj pogoda w warszawie': [
        weatherPage('https://weather.example/1'),
      ],
    });
    await runWebSearch({
      query: 'jaka jest dzisiaj pogoda w warszawie',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: async () =>
        '{"needs_search": true, "intent": "current Warsaw weather", "kind": "fact", "queries": ["warsaw weather"]}',
      today: '2026-07-20',
    });
    const logged = (label: string) => {
      const line = log.mock.calls
        .map((call) => String(call[0]))
        .find((entry) => entry.startsWith(`${label} `));
      return line ? JSON.parse(line.slice(label.length + 1)) : undefined;
    };
    expect(logged('Web search plan')).toMatchObject({
      needsSearch: true,
      kind: 'fact',
      queries: ['jaka jest dzisiaj pogoda w warszawie'],
    });
    expect(logged('Web search outcome')).toMatchObject({
      results: 1,
      withContent: 1,
      rounds: [{ results: 1 }],
    });
    log.mockRestore();
  });

  it('searches the planner’s discarded queries when the verbatim question finds nothing', async () => {
    const specPage: WebSearchResult = {
      title: 'Samsung QE65QN90D specs',
      url: 'https://specs.example/qn90d',
      snippet: 'Samsung QE65QN90D refresh rate 144 Hz',
      content: 'Samsung QE65QN90D refresh rate 144 Hz, 4K, Neo QLED. '.repeat(
        12
      ),
    };
    const provider = new MockProvider({
      'Samsung QE65QN90D refresh rate': [specPage],
    });
    const out = await runWebSearch({
      query: 'jaką częstotliwość odświeżania ma Samsung QE65QN90D?',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: async () =>
        '{"needs_search": true, "intent": "TV refresh rate", "kind": "specs", "queries": ["Samsung QE65QN90D refresh rate"]}',
      today: '2026-07-20',
    });
    expect(provider.calls).toEqual([
      'jaką częstotliwość odświeżania ma Samsung QE65QN90D?',
      'Samsung QE65QN90D refresh rate',
      'Samsung QE65QN90D',
    ]);
    expect(out.telemetry.plannedQueries).toContain(
      'Samsung QE65QN90D refresh rate'
    );
    expect(out.sourceDocuments.map((doc) => doc.url)).toEqual([specPage.url]);
  });

  it('retries a zero-result search with the question’s anchors and the expected terms', async () => {
    const specPage: WebSearchResult = {
      title: 'Samsung QE65QN90D — dane techniczne',
      url: 'https://sklep.example/qn90d',
      snippet: 'Samsung QE65QN90D częstotliwość odświeżania 144 Hz',
      content:
        'Samsung QE65QN90D częstotliwość odświeżania 144 Hz, 4K. '.repeat(12),
    };
    const provider = new MockProvider({
      'Samsung QE65QN90D częstotliwość odświeżania': [specPage],
    });
    const out = await runWebSearch({
      query: 'Jaka częstotliwość odświeżania ma Samsung QE65QN90D?',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: async () =>
        '{"needs_search": true, "intent": "TV refresh rate", "kind": "specs", "queries": ["Jaka częstotliwość odświeżania ma Samsung QE65QN90D?"], "expects": ["częstotliwość odświeżania"]}',
      today: '2026-07-20',
    });
    expect(provider.calls).toEqual([
      'Jaka częstotliwość odświeżania ma Samsung QE65QN90D?',
      'Samsung QE65QN90D częstotliwość odświeżania',
    ]);
    expect(out.sourceDocuments.map((doc) => doc.url)).toEqual([specPage.url]);
  });

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  it('keeps searching when the planner outlives the deadline', async () => {
    const provider = new MockProvider({
      'warsaw weather': [weatherPage('https://weather.example/1')],
    });
    const events: WebSearchProgressEvent[] = [];
    const out = await runWebSearch({
      query: 'warsaw weather',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: async () => {
        await delay(40);
        return '{"needs_search": true, "intent": "weather", "kind": "fact", "queries": ["warsaw weather"]}';
      },
      searchTimeoutMs: 10,
      onProgress: (event) => events.push(event),
      today: '2026-07-20',
    });
    expect(out.telemetry.aborted).toBeUndefined();
    expect(events.some((event) => event.type === 'timeout')).toBe(false);
    expect(out.sourceDocuments).toHaveLength(1);
  });

  it('gives up with a timeout when the search itself outlives the deadline', async () => {
    const provider = new MockProvider({
      'warsaw weather': [weatherPage('https://weather.example/1')],
    });
    const slowSearch = provider.search.bind(provider);
    provider.search = async (query: string) => {
      await delay(40);
      return slowSearch(query);
    };
    const events: WebSearchProgressEvent[] = [];
    const out = await runWebSearch({
      query: 'jaka jest pogoda w warszawie',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: async () =>
        '{"needs_search": true, "intent": "weather", "kind": "fact", "queries": ["Warsaw weather"]}',
      searchTimeoutMs: 10,
      onProgress: (event) => events.push(event),
      today: '2026-07-20',
    });
    expect(out.telemetry.aborted).toBe('timeout');
    expect(events.some((event) => event.type === 'timeout')).toBe(true);
    expect(provider.calls).toHaveLength(1);
    expect(out.sourceDocuments).toHaveLength(0);
  });

  it('records a stop when the caller aborts after the plan', async () => {
    const controller = new AbortController();
    const provider = new MockProvider({
      'warsaw weather': [weatherPage('https://weather.example/1')],
    });
    const events: WebSearchProgressEvent[] = [];
    const out = await runWebSearch({
      query: 'warsaw weather',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: async () => {
        controller.abort();
        return '{"needs_search": true, "intent": "weather", "kind": "fact", "queries": ["warsaw weather"]}';
      },
      signal: controller.signal,
      searchTimeoutMs: 1000,
      onProgress: (event) => events.push(event),
      today: '2026-07-20',
    });
    expect(out.telemetry.aborted).toBe('stopped');
    expect(events.some((event) => event.type === 'timeout')).toBe(false);
    expect(provider.calls).toHaveLength(0);
  });

  it('threads the planned intent into telemetry instead of dropping it', async () => {
    const provider = new MockProvider({
      'warsaw weather': [weatherPage('https://weather.example/1')],
    });
    const out = await runWebSearch({
      query: 'jaka jest dzisiaj pogoda w warszawie',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: async () =>
        '{"needs_search": true, "intent": "current Warsaw weather", "queries": ["warsaw weather"]}',
      today: '2026-07-20',
    });
    expect(out.telemetry.intent).toBe('current Warsaw weather');
  });

  it('ranks the kept results before spending the fetch budget', async () => {
    const filler = Array.from({ length: 4 }, (_, i) => ({
      title: `Gallery ${i}`,
      url: `https://gallery${i}.example/x`,
      snippet: 'photo album',
    }));
    const buried = {
      title: 'Warsaw weather',
      url: 'https://buried.example/x',
      snippet: 'Warsaw weather today temperature',
    };
    const provider = new MockProvider({
      'warsaw weather': [...filler, buried],
    });
    (extractArticle as jest.Mock).mockImplementation(async (url: string) => ({
      url,
      title: url,
      text: url.includes('buried') ? WEATHER_TEXT : SPORT_TEXT,
      siteName: url,
    }));

    const out = await runWebSearch({
      query: 'warsaw weather',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: noGen,
      today: '2026-07-20',
    });

    const read = out.sourceDocuments.filter((d) => d.read).map((d) => d.url);
    expect(read).toContain(buried.url);
  });

  it('drops results whose host does not match a site named in the question', async () => {
    const provider = new MockProvider({
      'transfermarkt najwięcej bramek dla Polski site:transfermarkt.pl': [
        {
          title: 'Transfermarkt page',
          url: 'https://www.transfermarkt.pl/poland/topscorer',
          snippet: 'Poland top scorer this season on Transfermarkt',
        },
        {
          title: 'Other site',
          url: 'https://espn.com/poland/topscorer',
          snippet: 'Poland top scorer on ESPN',
        },
      ],
    });
    const out = await runWebSearch({
      query:
        'sprawdź na stronie transfermarkt.pl kto strzelił najwięcej bramek dla Polski',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: async () =>
        '{"needs_search": true, "intent": "poland top scorer", "queries": ["transfermarkt najwięcej bramek dla Polski"]}',
      today: '2026-07-20',
    });
    expect(out.sourceDocuments).toHaveLength(1);
    expect(out.sourceDocuments[0]!.url).toContain('transfermarkt.pl');
  });

  describe('when a page cannot be read', () => {
    const readableExcept = (blocked: (url: string) => Error | null) =>
      (extractArticle as jest.Mock).mockImplementation(async (url: string) => {
        const failure = blocked(url);
        if (failure) throw failure;
        return { url, title: url, text: PHONE_TEXT, siteName: url };
      });

    it('searches the subject again away from the host that blocked the reader', async () => {
      const provider = new MockProvider({
        'Samsung Galaxy S25 cena': [bareResult('https://shop.example/s25')],
        'Samsung Galaxy S25 -site:shop.example': [
          bareResult('https://samsung.com/s25'),
        ],
      });
      readableExcept((url) =>
        url.includes('shop.example')
          ? new Error('Fetch failed: 403 Forbidden')
          : null
      );
      const events: WebSearchProgressEvent[] = [];

      const out = await runWebSearch({
        query: 'Samsung Galaxy S25 cena',
        history: [],
        provider,
        embeddings: null,
        embeddingModelReady: false,
        generate: noGen,
        onProgress: (e) => events.push(e),
        today: '2026-07-20',
      });

      expect(provider.calls).toContain('Samsung Galaxy S25 -site:shop.example');
      expect(out.telemetry.recovery[0]).toMatchObject({
        kind: 'primary-source',
      });
      expect(out.telemetry.rounds).toHaveLength(2);
      expect(out.context.join('\n')).toContain('Samsung Galaxy S25 price');
      expect(
        out.sourceDocuments.filter((d) => d.read).map((d) => d.url)
      ).toEqual(['https://samsung.com/s25']);
    });

    it('records why the page could not be read, and says so on the way past', async () => {
      const provider = new MockProvider({
        'Samsung Galaxy S25 cena': [bareResult('https://shop.example/s25')],
      });
      readableExcept(() => new Error('Fetch failed: 403 Forbidden'));
      const events: WebSearchProgressEvent[] = [];

      const out = await runWebSearch({
        query: 'Samsung Galaxy S25 cena',
        history: [],
        provider,
        embeddings: null,
        embeddingModelReady: false,
        generate: noGen,
        onProgress: (e) => events.push(e),
        today: '2026-07-20',
      });

      expect(out.telemetry.fetchFailures).toEqual([
        {
          url: 'https://shop.example/s25',
          host: 'shop.example',
          reason: 'blocked',
        },
      ]);
      expect(events).toContainEqual(
        expect.objectContaining({ type: 'failed', reason: 'blocked' })
      );
      expect(events.some((e) => e.type === 'recovering')).toBe(true);
    });

    it('retries the same host on another page when only that page was missing', async () => {
      const provider = new MockProvider({
        'Samsung Galaxy S25 cena': [bareResult('https://shop.example/gone')],
        'site:shop.example Samsung Galaxy S25': [
          bareResult('https://shop.example/s25'),
        ],
      });
      readableExcept((url) =>
        url.includes('/gone') ? new Error('Fetch failed: 404 Not Found') : null
      );

      const out = await runWebSearch({
        query: 'Samsung Galaxy S25 cena',
        history: [],
        provider,
        embeddings: null,
        embeddingModelReady: false,
        generate: noGen,
        today: '2026-07-20',
      });

      expect(provider.calls).toContain('site:shop.example Samsung Galaxy S25');
      expect(
        out.sourceDocuments.filter((d) => d.read).map((d) => d.url)
      ).toEqual(['https://shop.example/s25']);
    });

    it('does not spend a second fetch on a host that just blocked us', async () => {
      const provider = new MockProvider({
        'Samsung Galaxy S25 cena': [bareResult('https://shop.example/s25')],
        'Samsung Galaxy S25 -site:shop.example': [
          bareResult('https://shop.example/other'),
          bareResult('https://samsung.com/s25'),
        ],
      });
      readableExcept((url) =>
        url.includes('shop.example')
          ? new Error('Fetch failed: 403 Forbidden')
          : null
      );

      await runWebSearch({
        query: 'Samsung Galaxy S25 cena',
        history: [],
        provider,
        embeddings: null,
        embeddingModelReady: false,
        generate: noGen,
        today: '2026-07-20',
      });

      const fetched = (extractArticle as jest.Mock).mock.calls.map(
        (call) => call[0]
      );
      expect(fetched).not.toContain('https://shop.example/other');
      expect(fetched).toContain('https://samsung.com/s25');
    });

    it('leaves a healthy search alone — no failures, no extra round', async () => {
      const provider = new MockProvider({
        'Samsung Galaxy S25 cena': [bareResult('https://samsung.com/s25')],
      });
      readableExcept(() => null);

      const out = await runWebSearch({
        query: 'Samsung Galaxy S25 cena',
        history: [],
        provider,
        embeddings: null,
        embeddingModelReady: false,
        generate: noGen,
        today: '2026-07-20',
      });

      expect(out.telemetry.fetchFailures).toEqual([]);
      expect(out.telemetry.recovery).toEqual([]);
      expect(out.telemetry.rounds).toHaveLength(1);
      expect(provider.calls).toEqual(['Samsung Galaxy S25 cena']);
    });
  });

  it('reports the shortfall when retrieval is thin', async () => {
    const provider = new MockProvider({
      'warsaw weather forecast': [sportPage('https://sport.example/1')],
    });
    const events: WebSearchProgressEvent[] = [];
    const out = await runWebSearch({
      query: 'warsaw weather forecast',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: noGen,
      onProgress: (e) => events.push(e),
      today: '2026-07-20',
    });
    expect(out.telemetry.providerCalls).toBe(1);
    expect(out.telemetry.rounds).toHaveLength(1);
    expect(events.some((e) => e.type === 'weak')).toBe(true);
  });

  it('drops the same article listed under a second id on the same host', async () => {
    const duplicate = (url: string): WebSearchResult => ({
      title: 'Pogoda Kraków - Prognoza pogody godzinowa',
      url,
      snippet: 'weather temperature',
      content: WEATHER_TEXT,
    });
    const provider = new MockProvider({
      'warsaw weather': [
        duplicate('https://pogoda.example/krakow-306020'),
        duplicate('https://pogoda.example/krakow-306021'),
        weatherPage('https://other.example/1'),
      ],
    });

    const out = await runWebSearch({
      query: 'warsaw weather',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: noGen,
      today: '2026-07-20',
    });

    const urls = out.sourceDocuments.map((source) => source.url);
    expect(urls).toContain('https://pogoda.example/krakow-306020');
    expect(urls).not.toContain('https://pogoda.example/krakow-306021');
    expect(urls).toContain('https://other.example/1');
  });

  it('drops a same-host page whose body repeats one already read', async () => {
    const reprint = (url: string, title: string): WebSearchResult => ({
      title,
      url,
      snippet: 'weather temperature',
      content: WEATHER_TEXT,
    });
    const provider = new MockProvider({
      'warsaw weather': [
        reprint('https://pogoda.example/a', 'Warsaw weather today'),
        reprint('https://pogoda.example/b', 'Warsaw forecast'),
        weatherPage('https://other.example/1'),
      ],
    });

    const out = await runWebSearch({
      query: 'warsaw weather',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: noGen,
      today: '2026-07-20',
    });

    const urls = out.sourceDocuments.map((source) => source.url);
    expect(urls).toContain('https://pogoda.example/a');
    expect(urls).not.toContain('https://pogoda.example/b');
    expect(urls).toContain('https://other.example/1');
  });

  it('loads the embedding module around transient retrieval', async () => {
    const provider = new MockProvider({
      'warsaw weather': [weatherPage('https://weather.example/1')],
    });

    await runWebSearch({
      query: 'warsaw weather',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: noGen,
      today: '2026-07-20',
    });

    expect(fakeEmbeddings.runWithLoadedModel).toHaveBeenCalled();
  });

  it('evicts the LLM around every embedding step', async () => {
    const provider = new MockProvider({
      'warsaw weather': [weatherPage('https://weather.example/1')],
    });
    const order: string[] = [];
    const calls = { count: 0 };
    const isolateEmbeddings = async <T>(
      operation: () => Promise<T>
    ): Promise<T> => {
      calls.count += 1;
      order.push('offload');
      const result = await operation();
      order.push('restore');
      return result;
    };
    (fakeEmbeddings.runWithLoadedModel as jest.Mock).mockImplementation(
      async (operation: () => Promise<unknown>) => {
        order.push('embed');
        return operation();
      }
    );

    await runWebSearch({
      query: 'warsaw weather',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: noGen,
      isolateEmbeddings,
      today: '2026-07-20',
    });

    expect(calls.count).toBeGreaterThan(0);
    expect(order).toEqual(['offload', 'embed', 'restore']);
  });

  it('lean path (no embeddings) trusts extracted content and does not correct', async () => {
    const provider = new MockProvider({
      'warsaw weather': [weatherPage('https://weather.example/1')],
    });
    const out = await runWebSearch({
      query: 'warsaw weather',
      history: [],
      provider,
      embeddings: null,
      embeddingModelReady: false,
      generate: noGen,
      today: '2026-07-20',
    });
    expect(out.telemetry.providerCalls).toBe(1);
    expect(out.context.join('\n')).toContain('weather');
  });
});

describe('runWebSearch — reusing a previous turn', () => {
  const run = (provider: MockProvider, useCache: boolean) =>
    runWebSearch({
      query: 'warsaw weather',
      history: [],
      provider,
      embeddings: null,
      embeddingModelReady: false,
      generate: noGen,
      today: '2026-07-20',
      useCache,
    });

  beforeEach(() => {
    clearWebCaches();
    (extractArticle as jest.Mock).mockResolvedValue({
      url: 'https://weather.example/1',
      title: 'Warsaw weather',
      text: WEATHER_TEXT,
      siteName: 'weather.example',
    });
  });
  afterEach(() => clearWebCaches());

  it('serves the second identical question without touching the network', async () => {
    const provider = new MockProvider({
      'warsaw weather': [bareResult('https://weather.example/1')],
    });

    const first = await run(provider, true);
    const second = await run(provider, true);

    expect(first.telemetry.providerCalls).toBe(1);
    expect(second.telemetry.providerCalls).toBe(0);
    expect(provider.calls).toHaveLength(1);
    expect(extractArticle).toHaveBeenCalledTimes(1);
    expect(second.context.join('\n')).toContain('weather');
  });

  it('stays off unless the caller asks for it, so the eval harness is unaffected', async () => {
    const provider = new MockProvider({
      'warsaw weather': [bareResult('https://weather.example/1')],
    });

    await run(provider, false);
    await run(provider, false);

    expect(provider.calls).toHaveLength(2);
    expect(extractArticle).toHaveBeenCalledTimes(2);
  });

  it('does not cache an empty SERP, which is as likely to be a bot wall', async () => {
    const provider = new MockProvider({ 'warsaw weather': [] });

    await run(provider, true);
    await run(provider, true);

    expect(provider.calls).toHaveLength(2);
  });
});

describe('searching the question itself is a fallback, not a habit', () => {
  const plan =
    '{"needs_search": true, "intent": "weather", "queries": ["pogoda Warszawa prognoza"]}';

  it('leaves the question unsearched when the plan already found enough', async () => {
    const provider = new MockProvider({
      'pogoda Warszawa prognoza': [
        weatherPage('https://a.example/1'),
        weatherPage('https://b.example/2'),
        weatherPage('https://c.example/3'),
      ],
    });
    await runWebSearch({
      query: 'Jaka jest pogoda w Warszawie?',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: async () => plan,
      today: '2026-07-20',
    });
    expect(provider.calls).toEqual(['pogoda Warszawa prognoza']);
  });

  it('searches the question when the plan came back nearly empty', async () => {
    const provider = new MockProvider({
      'pogoda Warszawa prognoza': [weatherPage('https://a.example/1')],
      'Jaka jest pogoda w Warszawie?': [
        weatherPage('https://d.example/4'),
        weatherPage('https://e.example/5'),
      ],
    });
    await runWebSearch({
      query: 'Jaka jest pogoda w Warszawie?',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: async () => plan,
      today: '2026-07-20',
    });
    expect(provider.calls).toContain('Jaka jest pogoda w Warszawie?');
  });
});
