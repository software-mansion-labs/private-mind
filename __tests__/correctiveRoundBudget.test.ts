import type { WebSearchResult, WebSearchProvider } from '../utils/web/types';
import type { LFMEmbeddings } from '../utils/lfmEmbeddings';
import { interleaveByRound } from '../utils/web/mergeRounds';

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

const bare = (url: string, title: string): WebSearchResult => ({
  title,
  url,
  snippet: 'snippet',
});

const SPORT_TEXT =
  'Football match score last night in the league recap report. '.repeat(12);
const WEATHER_TEXT =
  'Warsaw weather today: 21C, sunny, light wind, temperature high. '.repeat(12);

const axisOf = (text: string): number[] => {
  const lower = text.toLowerCase();
  const weather = /weather|temperature|sunny/.test(lower) ? 1 : 0;
  const sport = /football|match|score|league/.test(lower) ? 1 : 0;
  return [weather, sport, weather || sport ? 0.1 : 1];
};
const embeddings = {
  embedQuery: jest.fn(async (t: string) => axisOf(t)),
  embedDocument: jest.fn(async (t: string) => axisOf(t)),
  runWithLoadedModel: jest.fn(<T>(operation: () => Promise<T>) => operation()),
} as unknown as LFMEmbeddings;

class TwoRoundProvider implements WebSearchProvider {
  readonly id = 'mock';
  queries: string[] = [];
  isReady() {
    return true;
  }
  async search(query: string): Promise<WebSearchResult[]> {
    this.queries.push(query);
    return this.queries.length === 1
      ? [1, 2, 3, 4, 5].map((n) => bare(`https://stale${n}.example/`, 'Recap'))
      : [1, 2, 3, 4, 5].map((n) =>
          bare(`https://fresh${n}.example/`, 'Weather')
        );
  }
}

describe('interleaveByRound', () => {
  it('alternates between rounds instead of appending', () => {
    const first = [bare('https://a/1', 'a1'), bare('https://a/2', 'a2')];
    const second = [bare('https://b/1', 'b1')];
    expect(interleaveByRound(first, second).map((r) => r.url)).toEqual([
      'https://a/1',
      'https://b/1',
      'https://a/2',
    ]);
  });

  it('keeps the longer round tail once the other runs out', () => {
    const first = [bare('https://a/1', 'a1')];
    const second = [bare('https://b/1', 'b1'), bare('https://b/2', 'b2')];
    expect(interleaveByRound(first, second).map((r) => r.url)).toEqual([
      'https://a/1',
      'https://b/1',
      'https://b/2',
    ]);
  });

  it('handles empty rounds', () => {
    expect(interleaveByRound([], [])).toEqual([]);
  });
});

describe('corrective round — fetch budget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    (extractArticle as jest.Mock).mockImplementation(async (url: string) => ({
      text: url.includes('fresh') ? WEATHER_TEXT : SPORT_TEXT,
    }));
  });
  afterEach(() => (console.warn as jest.Mock).mockRestore());

  it('reads pages the corrective round found, not only round one', async () => {
    const provider = new TwoRoundProvider();
    const out = await runWebSearch({
      query: 'warsaw weather forecast tomorrow',
      history: [],
      provider,
      embeddings,
      embeddingModelReady: true,
      generate: async () => '',
      today: '2026-07-20',
    });

    expect(out.telemetry.correctiveFired).toBe(true);
    const fetched = (extractArticle as jest.Mock).mock.calls.map(
      (call) => call[0] as string
    );
    expect(fetched.some((url) => url.includes('fresh'))).toBe(true);
  });
});
