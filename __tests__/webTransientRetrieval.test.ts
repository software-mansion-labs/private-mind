import type { WebSearchResult } from '../utils/web/types';
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

import { retrieveWebPassages } from '../utils/web/transientRetrieval';
import {
  WEB_RETRIEVAL_CHUNK_CHARS,
  WEB_RETRIEVAL_MAX_CHUNKS,
  WEB_RETRIEVAL_PAGE_MAX_CHARS,
} from '../constants/web';

const asChunk = (text: string): string =>
  text.padEnd(WEB_RETRIEVAL_CHUNK_CHARS, ' ');

const axisOf = (text: string): number[] => {
  const lower = text.toLowerCase();
  const weather = /weather|pogoda|temperature/.test(lower) ? 1 : 0;
  const sport = /football|match|score/.test(lower) ? 1 : 0;
  const filler = weather || sport ? 0.1 : 1;
  return [weather, sport, filler];
};

const fakeEmbeddings = {
  embedQuery: jest.fn(async (text: string) => axisOf(text)),
  embedDocument: jest.fn(async (text: string) => axisOf(text)),
} as unknown as LFMEmbeddings;

const failingEmbeddings = {
  embedQuery: jest.fn(async () => {
    throw new Error('model not loaded');
  }),
  embedDocument: jest.fn(),
} as unknown as LFMEmbeddings;

const result = (
  overrides: Partial<WebSearchResult> & { url: string }
): WebSearchResult => ({
  title: overrides.url,
  snippet: 'snippet',
  ...overrides,
});

const QUERY = { semanticQuery: 'weather in Warsaw', keywordQuery: 'weather' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  (console.warn as jest.Mock).mockRestore();
});

describe('retrieveWebPassages', () => {
  it('returns results unchanged with null signals when no page has content', async () => {
    const results = [result({ url: 'https://a.example' })];
    const out = await retrieveWebPassages(results, QUERY, fakeEmbeddings);
    expect(out.results).toEqual(results);
    expect(out.signals).toBeNull();
    expect(fakeEmbeddings.embedQuery).not.toHaveBeenCalled();
  });

  it('keeps on-topic passages, rewrites content, and reports signals', async () => {
    const onTopic = 'The weather in Warsaw is sunny with a high temperature.';
    const offTopic = 'Buy our newsletter now. Cookie settings and preferences.';
    const results = [
      result({
        url: 'https://weather.example',
        content: `${asChunk(offTopic)}${asChunk(onTopic)}`,
      }),
    ];

    const out = await retrieveWebPassages(results, QUERY, fakeEmbeddings);

    expect(out.results[0]!.content).toContain('weather');
    expect(out.results[0]!.content).not.toContain('newsletter');
    expect(out.signals).not.toBeNull();
    expect(out.signals!.embedded).toBe(true);
    expect(out.signals!.qualifiedCount).toBeGreaterThan(0);
    expect(out.signals!.maxSimilarity).toBeGreaterThan(0);
  });

  it('selects across pages and clears content on pages that lose retrieval', async () => {
    const results = [
      result({
        url: 'https://sport.example',
        content: 'Football match score last night in the league. '.repeat(4),
      }),
      result({
        url: 'https://weather.example',
        content: 'Warsaw weather today: 21C, sunny, light wind. '.repeat(4),
      }),
    ];

    const out = await retrieveWebPassages(results, QUERY, fakeEmbeddings);

    expect(out.results[1]!.content).toContain('weather');
    expect(out.results[0]!.content).toBeUndefined();
    expect(out.results).toHaveLength(2);
  });

  it('falls back to unchanged results with null signals when embedding fails', async () => {
    const results = [
      result({ url: 'https://a.example', content: 'weather content here' }),
    ];
    const out = await retrieveWebPassages(results, QUERY, failingEmbeddings);
    expect(out.results).toEqual(results);
    expect(out.signals).toBeNull();
  });

  it('caps the number of embedded chunks', async () => {
    const results = [
      result({
        url: 'https://long.example',
        content: 'weather word soup for Warsaw temperature readings. '.repeat(
          600
        ),
      }),
    ];

    await retrieveWebPassages(results, QUERY, fakeEmbeddings);

    const pageCapChunks = Math.ceil(
      WEB_RETRIEVAL_PAGE_MAX_CHARS / WEB_RETRIEVAL_CHUNK_CHARS
    );
    const embedded = (fakeEmbeddings.embedDocument as jest.Mock).mock.calls
      .length;
    expect(embedded).toBeLessThanOrEqual(
      Math.min(pageCapChunks, WEB_RETRIEVAL_MAX_CHUNKS)
    );
    expect(embedded).toBeGreaterThan(1);
  });
});
