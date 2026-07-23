import { enrichWebResults } from '../utils/web/enrichResults';
import { extractArticle } from '../utils/web/url/extractArticle';
import type { WebSearchResult } from '../utils/web/types';

jest.mock('../utils/web/url/extractArticle', () => ({
  ...jest.requireActual('../utils/web/url/extractArticle'),
  extractArticle: jest.fn(),
}));

const mockExtract = extractArticle as jest.MockedFunction<
  typeof extractArticle
>;

const result = (over: Partial<WebSearchResult> = {}): WebSearchResult => ({
  title: 'T',
  url: 'https://a.com/1',
  snippet: 's',
  ...over,
});

describe('enrichWebResults', () => {
  afterEach(() => jest.clearAllMocks());

  const longText = (marker: string): string =>
    `${marker} ${'lorem ipsum dolor sit amet '.repeat(10)}`.trim();

  it('attaches extracted content to the top N results only', async () => {
    mockExtract.mockImplementation(async (url) => ({
      url,
      title: 'x',
      text: longText(`content of ${url}`),
      siteName: 'a.com',
    }));

    const enriched = await enrichWebResults(
      [
        result({ url: 'https://a.com/1' }),
        result({ url: 'https://a.com/2' }),
        result({ url: 'https://a.com/3' }),
      ],
      2
    );

    expect(enriched[0].content).toContain('content of https://a.com/1');
    expect(enriched[1].content).toContain('content of https://a.com/2');
    expect(enriched[2].content).toBeUndefined();
    expect(mockExtract).toHaveBeenCalledTimes(2);
  });

  it('falls back to the original result when extraction fails', async () => {
    mockExtract.mockRejectedValue(new Error('network'));

    const enriched = await enrichWebResults([result()], 1);

    expect(enriched[0].content).toBeUndefined();
    expect(enriched[0].snippet).toBe('s');
  });

  it('does not attach empty extracted text', async () => {
    mockExtract.mockResolvedValue({
      url: 'https://a.com/1',
      title: 'x',
      text: '   ',
      siteName: 'a.com',
    });

    const enriched = await enrichWebResults([result()], 1);

    expect(enriched[0].content).toBeUndefined();
  });

  it('is a no-op when topN is 0 (feature disabled)', async () => {
    const results = [result()];
    const enriched = await enrichWebResults(results, 0);

    expect(enriched).toBe(results);
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it('drops a bot-wall page and keeps the honest snippet', async () => {
    mockExtract.mockResolvedValue({
      url: 'https://tickets.example/1',
      title: 'Just a moment...',
      text: 'Checking your browser before accessing tickets.example. Please enable JavaScript and cookies to continue.',
      siteName: 'tickets.example',
    });
    const seen: { ok: boolean }[] = [];

    const enriched = await enrichWebResults([result()], 1, (e) => seen.push(e));

    expect(enriched[0].content).toBeUndefined();
    expect(enriched[0].snippet).toBe('s');
    expect(seen).toEqual([expect.objectContaining({ ok: false })]);
  });

  it('drops a near-empty JS app shell instead of letting it displace the snippet', async () => {
    mockExtract.mockResolvedValue({
      url: 'https://spa.example/1',
      title: 'Festival 2026',
      text: 'Loading…',
      siteName: 'spa.example',
    });

    const enriched = await enrichWebResults([result()], 1);

    expect(enriched[0].content).toBeUndefined();
  });

  it('keeps a long legitimate article that merely mentions verification', async () => {
    const text = `How ticket shops fight bots: verify you are human prompts explained. ${'Detailed analysis paragraph. '.repeat(40)}`;
    mockExtract.mockResolvedValue({
      url: 'https://blog.example/1',
      title: 'How ticket shops fight bots',
      text,
      siteName: 'blog.example',
    });

    const enriched = await enrichWebResults([result()], 1);

    expect(enriched[0].content).toBe(text.trim());
  });
});
