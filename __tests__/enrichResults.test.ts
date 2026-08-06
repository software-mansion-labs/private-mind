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

  it('frees a failed page slot for the next candidate down the ranking', async () => {
    mockExtract.mockImplementation(async (url) => {
      if (url === 'https://a.com/1') throw new Error('dead site');
      return {
        url,
        title: 'x',
        text: longText(`content of ${url}`),
        siteName: 'a.com',
      };
    });

    const enriched = await enrichWebResults(
      [
        result({ url: 'https://a.com/1' }),
        result({ url: 'https://a.com/2' }),
        result({ url: 'https://a.com/3' }),
      ],
      2
    );

    expect(enriched[0].content).toBeUndefined();
    expect(enriched[1].content).toContain('content of https://a.com/2');
    expect(enriched[2].content).toContain('content of https://a.com/3');
    expect(mockExtract).toHaveBeenCalledTimes(3);
  });

  it('treats a bot wall like a failure and moves down the ranking', async () => {
    mockExtract.mockImplementation(async (url) =>
      url === 'https://a.com/1'
        ? {
            url,
            title: 'Just a moment...',
            text: 'Checking your browser before accessing a.com. Please enable JavaScript and cookies to continue.',
            siteName: 'a.com',
          }
        : {
            url,
            title: 'x',
            text: longText(`content of ${url}`),
            siteName: 'a.com',
          }
    );

    const enriched = await enrichWebResults(
      [result({ url: 'https://a.com/1' }), result({ url: 'https://a.com/2' })],
      1
    );

    expect(enriched[0].content).toBeUndefined();
    expect(enriched[1].content).toContain('content of https://a.com/2');
  });

  it('stops when the candidate list runs out, not at the budget', async () => {
    mockExtract.mockRejectedValue(new Error('everything is down'));

    const enriched = await enrichWebResults(
      [result({ url: 'https://a.com/1' }), result({ url: 'https://a.com/2' })],
      2
    );

    expect(enriched.every((r) => r.content === undefined)).toBe(true);
    expect(mockExtract).toHaveBeenCalledTimes(2);
  });

  it('replaces failures one at a time in sequential mode', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    mockExtract.mockImplementation(async (url) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      if (url === 'https://a.com/1') throw new Error('dead site');
      return {
        url,
        title: 'x',
        text: longText(`content of ${url}`),
        siteName: 'a.com',
      };
    });

    const enriched = await enrichWebResults(
      [
        result({ url: 'https://a.com/1' }),
        result({ url: 'https://a.com/2' }),
        result({ url: 'https://a.com/3' }),
      ],
      2,
      undefined,
      undefined,
      undefined,
      undefined,
      true
    );

    expect(maxInFlight).toBe(1);
    expect(enriched[1].content).toContain('content of https://a.com/2');
    expect(enriched[2].content).toContain('content of https://a.com/3');
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

describe('enrichWebResults — abort signal', () => {
  afterEach(() => jest.clearAllMocks());

  it('passes the signal through to the fetcher', async () => {
    mockExtract.mockImplementation(async (url) => ({
      url,
      title: 'x',
      text: 'some fetched text long enough to keep',
      siteName: 'a.com',
    }));
    const controller = new AbortController();

    await enrichWebResults(
      [result()],
      1,
      undefined,
      undefined,
      undefined,
      controller.signal
    );

    expect(mockExtract).toHaveBeenCalledWith(
      'https://a.com/1',
      expect.any(Number),
      controller.signal
    );
  });

  it('skips fetching entirely when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const input = [result(), result({ url: 'https://a.com/2' })];

    const out = await enrichWebResults(
      input,
      2,
      undefined,
      undefined,
      undefined,
      controller.signal
    );

    expect(mockExtract).not.toHaveBeenCalled();
    expect(out).toEqual(input);
  });
});
