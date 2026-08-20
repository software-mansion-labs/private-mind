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
      'transfermarkt poland top scorer site:transfermarkt.pl': [
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
        '{"needs_search": true, "intent": "poland top scorer", "queries": ["transfermarkt poland top scorer"]}',
      today: '2026-07-20',
    });
    expect(out.sourceDocuments).toHaveLength(1);
    expect(out.sourceDocuments[0]!.url).toContain('transfermarkt.pl');
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
