import type { WebSearchResult, WebSearchProvider } from '../utils/web/types';
import type { LFMEmbeddings } from '../utils/lfmEmbeddings';
import { WEB_CONTENT_MAX_CHARS } from '../constants/web';
import {
  MULTILINGUAL_SCENARIOS,
  ALL_LANGS,
  type MultilingualScenario,
  type LangCode,
} from './fixtures/multilingualQueries';

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

import { runWebSearch } from '../utils/web/runWebSearch';
import { selectRelevantContent } from '../utils/web/webResultsToContext';

const embeddings = {
  embedQuery: jest.fn(async () => [1, 0, 0]),
  embedDocument: jest.fn(async () => [1, 0, 0]),
  runWithLoadedModel: jest.fn(<T>(op: () => Promise<T>) => op()),
} as unknown as LFMEmbeddings;

class SinglePageProvider implements WebSearchProvider {
  readonly id = 'fixture';
  constructor(private readonly page: WebSearchResult) {}
  isReady() {
    return true;
  }
  async search(): Promise<WebSearchResult[]> {
    return [this.page];
  }
}

const pageFor = (s: MultilingualScenario): WebSearchResult => ({
  title: s.query,
  url: `https://example-${s.id}.test/article`,
  snippet: s.snippet,
  content: s.content,
});

const noGen = async () => '';

const delivered = async (s: MultilingualScenario): Promise<boolean> => {
  const result = await runWebSearch({
    query: s.query,
    history: [],
    provider: new SinglePageProvider(pageFor(s)),
    embeddings,
    embeddingModelReady: false,
    generate: noGen,
    today: '2026-08-04',
  });
  return result.context.join('\n').includes(s.marker);
};

const MAX_ARTICLE_SHARE = 0.25;
const MAX_EXCERPT_CHARS = 400;

interface Precision {
  selected: boolean;
  chars: number;
  ratio: number;
}

const precisionOf = (s: MultilingualScenario): Precision => {
  const excerpt = selectRelevantContent(
    s.content,
    s.query,
    WEB_CONTENT_MAX_CHARS
  );
  return {
    selected:
      excerpt.includes(s.answer) &&
      excerpt.length <= s.content.length * MAX_ARTICLE_SHARE &&
      excerpt.length <= MAX_EXCERPT_CHARS,
    chars: excerpt.length,
    ratio: excerpt.length / s.answer.length,
  };
};

const pct = (hit: number, total: number) =>
  total === 0 ? 0 : Math.round((100 * hit) / total);

interface LangStat {
  lang: LangCode;
  share: number;
  n: number;
  delivery: number;
  precision: number;
  medianChars: number;
  nonLatinTerminator: boolean;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

describe('multilingual web search — 103 everyday questions, 15 languages', () => {
  jest.setTimeout(300_000);

  it('selects the answering passage in every language we ship to', async () => {
    const stats: LangStat[] = [];

    for (const lang of ALL_LANGS) {
      const items = MULTILINGUAL_SCENARIOS.filter((s) => s.lang === lang);
      const deliveries: boolean[] = [];
      for (const s of items) deliveries.push(await delivered(s));
      const precisions = items.map(precisionOf);

      stats.push({
        lang,
        share: items[0].share,
        n: items.length,
        delivery: pct(deliveries.filter(Boolean).length, items.length),
        precision: pct(
          precisions.filter((p) => p.selected).length,
          items.length
        ),
        medianChars: median(precisions.map((p) => p.chars)),
        nonLatinTerminator: items[0].nonLatinTerminator,
      });
    }

    const lines = [
      '',
      '=== MULTILINGUAL WEB SEARCH (keyword path) ===',
      'lang  share    n   delivered   selected   median chars   terminator',
    ];
    for (const st of stats) {
      lines.push(
        `${st.lang.padEnd(4)}  ${String(st.share).padStart(4)}%  ${String(st.n).padStart(3)}   ` +
          `${String(st.delivery).padStart(7)}%   ${String(st.precision).padStart(6)}%   ` +
          `${String(st.medianChars).padStart(10)}     ` +
          `${st.nonLatinTerminator ? 'NON-LATIN' : 'latin'}`
      );
    }
    const weighted = (pick: (s: LangStat) => number) =>
      Math.round(
        stats.reduce((acc, s) => acc + pick(s) * s.share, 0) /
          stats.reduce((acc, s) => acc + s.share, 0)
      );
    lines.push(
      `WEIGHTED BY INSTALL SHARE      ${String(weighted((s) => s.delivery)).padStart(7)}%   ` +
        `${String(weighted((s) => s.precision)).padStart(6)}%`
    );
    lines.push('');
    process.stdout.write(lines.join('\n') + '\n');

    const badDelivery = stats.filter((s) => s.delivery < 90);
    expect(badDelivery.map((s) => `${s.lang}=${s.delivery}%`).join(' ')).toBe(
      ''
    );

    const badPrecision = stats.filter((s) => s.precision < 90);
    expect(badPrecision.map((s) => `${s.lang}=${s.precision}%`).join(' ')).toBe(
      ''
    );
  });
});
