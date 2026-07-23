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

import { extractArticle } from '../utils/web/url/extractArticle';
import { runWebSearch } from '../utils/web/runWebSearch';
import { WEB_RETRIEVAL_FETCH_TOP_N } from '../constants/web';

const axisOf = (text: string): number[] => {
  const lower = text.toLowerCase();
  const weather = /weather|temperature/.test(lower) ? 1 : 0;
  const sport = /football|match|score/.test(lower) ? 1 : 0;
  const filler = weather || sport ? 0.1 : 1;
  return [weather, sport, filler];
};
const fakeEmbeddings = {
  embedQuery: jest.fn(async (t: string) => axisOf(t)),
  embedDocument: jest.fn(async (t: string) => axisOf(t)),
} as unknown as LFMEmbeddings;

const bare = (url: string): WebSearchResult => ({
  title: 'Result',
  url,
  snippet: 'snippet',
});

const WEATHER_TEXT =
  'Warsaw weather today: 21C, sunny, light wind, temperature high. '.repeat(12);
const SPORT_TEXT =
  'Football match score last night in the league recap report. '.repeat(12);

class MockProvider implements WebSearchProvider {
  readonly id = 'mock';
  calls: string[] = [];
  constructor(private readonly results: WebSearchResult[]) {}
  isReady() {
    return true;
  }
  async search(query: string): Promise<WebSearchResult[]> {
    this.calls.push(query);
    return this.results;
  }
}

const setup = (offTopic: string[]) => {
  const urls = [1, 2, 3, 4, 5].map((n) => `https://page${n}.example/`);
  (extractArticle as jest.Mock).mockImplementation(async (url: string) => ({
    text: offTopic.includes(url) ? SPORT_TEXT : WEATHER_TEXT,
  }));
  return new MockProvider(urls.map(bare));
};

const run = (provider: WebSearchProvider) =>
  runWebSearch({
    query: 'warsaw weather',
    history: [],
    provider,
    embeddings: fakeEmbeddings,
    embeddingModelReady: true,
    generate: async () => '',
    today: '2026-07-20',
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => (console.warn as jest.Mock).mockRestore());

describe('adaptive enrichment', () => {
  it('stops after the first wave when it already answers the query', async () => {
    const provider = setup([]);
    const out = await run(provider);

    const round1 = out.telemetry.rounds[0]!;
    expect(round1.enrichWaves).toBe(1);
    expect(round1.enrichedPages).toBe(2);
    expect(extractArticle).toHaveBeenCalledTimes(2);
    expect(round1.label).toBe('correct');
    expect(out.context.join('\n')).toContain('weather');
  });

  it('escalates to the top-N ceiling when the first wave is off-topic', async () => {
    const provider = setup([
      'https://page1.example/',
      'https://page2.example/',
    ]);
    const out = await run(provider);

    const round1 = out.telemetry.rounds[0]!;
    expect(round1.enrichWaves).toBe(2);
    expect(round1.enrichedPages).toBe(4);
    expect(extractArticle).toHaveBeenCalledTimes(4);
    expect(round1.label).toBe('correct');
    expect(out.context.join('\n')).toContain('weather');
  });

  it('escalates no further than the ceiling when nothing ever qualifies', async () => {
    const provider = setup(
      [1, 2, 3, 4, 5].map((n) => `https://page${n}.example/`)
    );
    const out = await run(provider);

    const round1 = out.telemetry.rounds[0]!;
    expect(round1.enrichedPages).toBe(WEB_RETRIEVAL_FETCH_TOP_N);
    expect(round1.enrichWaves).toBe(3);
    expect(extractArticle).toHaveBeenCalledTimes(WEB_RETRIEVAL_FETCH_TOP_N);
  });

  it('does not re-fetch a page that failed enrichment as the wave widens', async () => {
    const urls = [1, 2, 3, 4, 5].map((n) => `https://page${n}.example/`);
    const calls: string[] = [];
    (extractArticle as jest.Mock).mockImplementation(async (url: string) => {
      calls.push(url);
      return { text: url === urls[0] ? '' : SPORT_TEXT };
    });
    const provider = new MockProvider(urls.map(bare));

    await run(provider);

    expect(calls.filter((url) => url === urls[0])).toHaveLength(1);
    expect(calls.length).toBeGreaterThan(1);
  });

  it('re-ranks a widened page set without re-embedding what it already embedded', async () => {
    const provider = setup([
      'https://page1.example/',
      'https://page2.example/',
    ]);
    await run(provider);

    const embedded = (fakeEmbeddings.embedDocument as jest.Mock).mock.calls.map(
      (call) => call[0] as string
    );
    expect(embedded.length).toBeGreaterThan(0);
    expect(new Set(embedded).size).toBe(embedded.length);
    expect(fakeEmbeddings.embedQuery).toHaveBeenCalledTimes(1);
  });
});
