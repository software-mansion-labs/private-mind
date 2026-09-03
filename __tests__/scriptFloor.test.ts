import type { WebSearchProvider, WebSearchResult } from '../utils/web/types';

jest.mock('react-native-rag', () => ({
  RecursiveCharacterTextSplitter: jest.fn().mockImplementation(() => ({
    splitText: jest.fn(async (text: string) => [text]),
  })),
}));

import { runWebSearch } from '../utils/web/runWebSearch';
import { clearWebCaches } from '../utils/web/cache/webCache';
import { WEB_MIN_SAME_SCRIPT_RESULTS } from '../constants/web';

const page = (title: string, snippet: string, n: number): WebSearchResult => ({
  title,
  url: `https://example.com/${n}`,
  snippet,
});

class Provider implements WebSearchProvider {
  readonly id = 'mock';
  calls: string[] = [];
  constructor(private readonly results: WebSearchResult[]) {}
  async search(query: string): Promise<WebSearchResult[]> {
    this.calls.push(query);
    return this.results;
  }
}

// The English pages DuckDuckGo actually returned for "current weather in
// Moscow", the plan a translating planner produces for the Russian question.
const LATIN_RESULTS = [
  page('Moscow, Russia Weather Forecast', 'Current conditions in Moscow.', 1),
  page('Weather Moscow - meteoblue', 'Professional weather forecast.', 2),
  page('Moscow Weather Today | AccuWeather', 'Hourly forecast for Moscow.', 3),
  page('Moscow 14 day weather forecast', 'Two week outlook.', 4),
  page('Current Weather in Moscow', 'Temperature and wind right now.', 5),
];

const run = (query: string, results: WebSearchResult[]) => {
  const provider = new Provider(results);
  return runWebSearch({
    query,
    history: [],
    provider,
    embeddings: null,
    embeddingModelReady: false,
    generate: async () => '',
    fetchArticle: async (url: string) => ({ text: '', title: '', url }),
  });
};

beforeEach(() => {
  clearWebCaches();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => (console.warn as jest.Mock).mockRestore());

describe('foreign-script results below the same-script floor', () => {
  // Before the floor, a Cyrillic question against Latin results left the model
  // with nothing at all: measured 0 of 10 survivors against the real engine.
  it('keeps Latin results for a Cyrillic question rather than discarding them', async () => {
    const out = await run('какая сегодня погода в Москве', LATIN_RESULTS);
    expect(out.sourceDocuments.length).toBeGreaterThan(0);
  });

  it('still drops foreign-script results as soon as one same-script result exists', async () => {
    const sameScript = Array.from(
      { length: WEB_MIN_SAME_SCRIPT_RESULTS },
      (_, i) =>
        page(`Погода в Москве ${i}`, 'Прогноз погоды на сегодня.', 100 + i)
    );
    const out = await run('какая сегодня погода в Москве', [
      ...LATIN_RESULTS,
      ...sameScript,
    ]);
    const names = out.sourceDocuments.map((d) => d.name).join(' ');
    expect(names).toContain('Погода');
    expect(names).not.toContain('AccuWeather');
  });

  it('leaves a same-script question untouched', async () => {
    const out = await run('current weather in Moscow', LATIN_RESULTS);
    expect(out.sourceDocuments.length).toBeGreaterThan(0);
  });
});
