jest.mock('react-native-rag', () => ({
  RecursiveCharacterTextSplitter: jest.fn(),
}));

import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  ExtractedArticle,
  WebSearchProvider,
  WebSearchResult,
} from '../utils/web/types';
import { runWebSearch } from '../utils/web/runWebSearch';
import { clearWebCaches } from '../utils/web/cache/webCache';
import { getChatMessages } from '../database/chatRepository';

const QUESTION = 'Who founded Zorblax Industries?';
const PAGE_BODY = `Zorblax Industries was founded by Ada Quill. ${'general company profile. '.repeat(8)}`;

class MockProvider implements WebSearchProvider {
  readonly id = 'mock';
  isReady() {
    return true;
  }
  async search(): Promise<WebSearchResult[]> {
    return [
      {
        title: 'Zorblax',
        url: 'https://a.example/zorblax',
        snippet: 'Zorblax Industries',
      },
    ];
  }
}

const fetchWithExtraction = async (
  url: string,
  _timeoutMs?: number,
  _signal?: AbortSignal,
  onExtractMs?: (ms: number) => void
): Promise<ExtractedArticle> => {
  onExtractMs?.(7);
  return { url, title: url, text: PAGE_BODY, siteName: url };
};

const plannerJson = async () =>
  JSON.stringify({
    needs_search: true,
    intent: 'founder',
    kind: 'fact',
    queries: ['Zorblax Industries founder'],
  });

beforeEach(() => {
  clearWebCaches();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const run = () =>
  runWebSearch({
    query: QUESTION,
    history: [],
    provider: new MockProvider(),
    embeddings: null,
    embeddingModelReady: false,
    generate: plannerJson,
    fetchArticle: fetchWithExtraction,
    today: '2026-07-20',
  });

describe('web stage timings', () => {
  it('records the fast planner, per-query search, per-page fetch and extraction, and ranking', async () => {
    const { telemetry } = await run();
    const timings = telemetry.timings!;

    expect(timings.plannerMs).toEqual(expect.any(Number));
    expect(timings.planner).toBe('fast');
    expect(timings.searches[0]).toEqual({
      query: QUESTION,
      ms: expect.any(Number),
    });
    expect(timings.pages[0]).toEqual({
      host: 'a.example',
      ms: expect.any(Number),
      extractMs: 7,
    });
    expect(timings.embedRankMs).toEqual(expect.any(Number));
  });

  it('marks a repeated query as served from the cache', async () => {
    const withCache = () =>
      runWebSearch({
        query: QUESTION,
        history: [],
        provider: new MockProvider(),
        embeddings: null,
        embeddingModelReady: false,
        generate: plannerJson,
        fetchArticle: fetchWithExtraction,
        today: '2026-07-20',
        useCache: true,
      });
    await withCache();
    const { telemetry } = await withCache();

    expect(telemetry.timings!.searches[0]).toMatchObject({ cached: true });
    expect(telemetry.timings!.pages[0]).toMatchObject({ cached: true });
  });
});

describe('timings survive a reload', () => {
  const timings = {
    plannerMs: 19000,
    searches: [{ query: 'q', ms: 900 }],
    pages: [{ host: 'a.example', ms: 2000, extractMs: 40 }],
    embedRankMs: 3100,
  };
  const dbReturning = (web: unknown) =>
    ({
      getAllAsync: jest.fn().mockResolvedValue([
        {
          id: 1,
          chatId: 1,
          role: 'assistant',
          content: 'Answered.',
          retrievalStats: JSON.stringify({ web }),
        },
      ]),
    }) as Partial<SQLiteDatabase> as SQLiteDatabase;

  it('reads the optional timings back next to the counts', async () => {
    const web = { ms: 8420, sources: 5, read: 3, queries: 2, timings };
    const messages = await getChatMessages(dbReturning(web), 1);

    expect(messages[0].retrievalStats).toEqual({ web });
  });

  it('drops malformed timings but keeps the counts', async () => {
    const web = {
      ms: 8420,
      sources: 5,
      read: 3,
      queries: 2,
      timings: { searches: 'nope' },
    };
    const messages = await getChatMessages(dbReturning(web), 1);

    expect(messages[0].retrievalStats).toEqual({
      web: { ms: 8420, sources: 5, read: 3, queries: 2 },
    });
  });
});
