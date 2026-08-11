import type { WebSearchResult, WebSearchProvider } from '../utils/web/types';

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
import { extractArticle } from '../utils/web/url/extractArticle';

const extractArticleMock = extractArticle as jest.MockedFunction<
  typeof extractArticle
>;

const FILLER =
  'Background detail a reader skims past on the way to the figure, repeated ' +
  'so the body clears the minimum length enrichment requires before it will ' +
  'keep a fetched page at all. ';

const PAGES: Record<string, { title: string; body: string }> = {
  'https://specs.example/battery': {
    title: 'Aurora Tab battery capacity',
    body: `The Aurora Tab battery capacity is 7350 mAh. ${FILLER.repeat(2)}`,
  },
  'https://shop.example/price': {
    title: 'Nimbus Dock price',
    body: `The Nimbus Dock costs 249 EUR. ${FILLER.repeat(2)}`,
  },
};

class TermProvider implements WebSearchProvider {
  readonly id = 'term';
  calls: string[] = [];
  isReady() {
    return true;
  }
  async search(query: string): Promise<WebSearchResult[]> {
    this.calls.push(query);
    const lower = query.toLowerCase();
    const out: WebSearchResult[] = [];
    if (/aurora|battery|bateria/.test(lower)) {
      out.push({
        title: PAGES['https://specs.example/battery'].title,
        url: 'https://specs.example/battery',
        snippet: 'Aurora Tab specifications overview.',
      });
    }
    if (/nimbus|price|cena|dock/.test(lower)) {
      out.push({
        title: PAGES['https://shop.example/price'].title,
        url: 'https://shop.example/price',
        snippet: 'Nimbus Dock listing.',
      });
    }
    return out;
  }
}

const run = async (provider: TermProvider, plannedQueries: string[]) =>
  runWebSearch({
    query:
      'What is the Aurora Tab battery capacity and how much does the Nimbus Dock cost?',
    history: [],
    provider,
    embeddings: null,
    embeddingModelReady: false,
    generate: async () =>
      JSON.stringify({
        needs_search: true,
        intent: 'two specs',
        queries: plannedQueries,
      }),
    today: '2026-07-27',
  });

describe('multi-hop retrieval coverage', () => {
  beforeEach(() => {
    extractArticleMock.mockImplementation(async (url: string) => ({
      url,
      title: PAGES[url]?.title ?? '',
      text: PAGES[url]?.body ?? '',
      excerpt: '',
      siteName: new URL(url).hostname,
    }));
  });

  it('searches the half of the question the first round missed', async () => {
    const provider = new TermProvider();
    const out = await run(provider, ['Aurora Tab battery capacity']);
    expect(out.telemetry.correctiveSource).toBe('coverage');
    expect(provider.calls).toContain('nimbus dock cost');
  });

  it('delivers both facts even though the planner asked for one', async () => {
    const provider = new TermProvider();
    const out = await run(provider, ['Aurora Tab battery capacity']);
    const context = out.context.join('\n');
    expect(context).toContain('7350');
    expect(context).toContain('249');
  });

  it('two planner queries reach both facts', async () => {
    const provider = new TermProvider();
    const out = await run(provider, [
      'Aurora Tab battery capacity',
      'Nimbus Dock price',
    ]);
    const context = out.context.join('\n');
    expect(context).toContain('7350');
    expect(context).toContain('249');
  });
});
