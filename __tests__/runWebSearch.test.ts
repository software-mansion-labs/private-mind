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
    return this.map[query] ?? [];
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

  it('runs a single round and no corrective round on strong retrieval', async () => {
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
    expect(out.telemetry.correctiveFired).toBe(false);
    expect(out.telemetry.providerCalls).toBe(1);
    expect(out.telemetry.rounds).toHaveLength(1);
    expect(out.context.join('\n')).toContain('weather');
    expect(events.some((e) => e.type === 'searching')).toBe(true);
    expect(events.some((e) => e.type === 'done')).toBe(true);
  });

  it('fires ONE corrective round on weak round 1 and recovers', async () => {
    const provider = new MockProvider({
      'warsaw weather forecast': [sportPage('https://sport.example/1')],
      'warsaw weather': [weatherPage('https://weather.example/2')],
    });
    const out = await runWebSearch({
      query: 'warsaw weather forecast',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: noGen,
      today: '2026-07-20',
    });
    expect(out.telemetry.correctiveFired).toBe(true);
    expect(out.telemetry.correctiveQuery).toBe('warsaw weather');
    expect(out.telemetry.providerCalls).toBe(2);
    expect(out.telemetry.rounds).toHaveLength(2);
    expect(out.context.join('\n')).toContain('weather');
  });

  it('never exceeds the corrective cap even when round 2 also fails', async () => {
    const provider = new MockProvider({
      'warsaw weather forecast': [sportPage('https://sport.example/1')],
      'warsaw weather': [sportPage('https://sport.example/2')],
    });
    const out = await runWebSearch({
      query: 'warsaw weather forecast',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: noGen,
      today: '2026-07-20',
    });
    expect(out.telemetry.correctiveFired).toBe(true);
    expect(out.telemetry.providerCalls).toBe(2);
    expect(out.telemetry.rounds.length).toBeLessThanOrEqual(2);
  });

  it('reuses round 1 pages in the corrective round instead of re-fetching', async () => {
    const provider = new MockProvider({
      'warsaw weather forecast': [bareResult('https://sport.example/1')],
      'warsaw weather': [bareResult('https://weather.example/2')],
    });
    const fetched: string[] = [];
    (extractArticle as jest.Mock).mockImplementation(async (url: string) => {
      fetched.push(url);
      return { text: url.includes('sport') ? SPORT_TEXT : WEATHER_TEXT };
    });

    const out = await runWebSearch({
      query: 'warsaw weather forecast',
      history: [],
      provider,
      embeddings: fakeEmbeddings,
      embeddingModelReady: true,
      generate: noGen,
      today: '2026-07-20',
    });

    expect(out.telemetry.correctiveFired).toBe(true);
    expect(fetched.filter((url) => url === 'https://sport.example/1')).toEqual([
      'https://sport.example/1',
    ]);
    expect(fetched).toContain('https://weather.example/2');
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
    expect(out.telemetry.correctiveFired).toBe(false);
    expect(out.telemetry.providerCalls).toBe(1);
    expect(out.context.join('\n')).toContain('weather');
  });
});
