import {
  extractArticle,
  looksLikeBotWall,
} from '../utils/web/url/extractArticle';

const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>Fallback Title</title>
    <meta property="og:title" content="Reanimated Docs" />
  </head>
  <body>
    <nav>Home About <a href="/login">Login</a></nav>
    <header>Site header junk</header>
    <article>
      <h1>Reanimated</h1>
      <p>Reanimated lets you build smooth animations on the UI thread.</p>
      <script>console.log('tracking');</script>
    </article>
    <footer>Cookie banner &amp; ads</footer>
  </body>
</html>`;

const mockFetch = (body: string, ok = true) =>
  jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Error',
    text: () => Promise.resolve(body),
  });

describe('extractArticle', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('extracts main-article text and strips nav/header/footer/scripts', async () => {
    global.fetch = mockFetch(html) as unknown as typeof fetch;
    const article = await extractArticle('https://docs.swmansion.com/x');

    expect(article.text).toContain('smooth animations on the UI thread');
    expect(article.text).not.toContain('Login');
    expect(article.text).not.toContain('Site header junk');
    expect(article.text).not.toContain('Cookie banner');
    expect(article.text).not.toContain('tracking');
  });

  it('prefers the og:title, falling back to the hostname', async () => {
    global.fetch = mockFetch(html) as unknown as typeof fetch;
    const withTitle = await extractArticle('https://docs.swmansion.com/x');
    expect(withTitle.title).toBe('Reanimated Docs');

    global.fetch = mockFetch(
      '<html><body><p>no title here</p></body></html>'
    ) as unknown as typeof fetch;
    const noTitle = await extractArticle('https://www.example.com/page');
    expect(noTitle.title).toBe('example.com');
  });

  it('throws on a non-ok response', async () => {
    global.fetch = mockFetch('', false) as unknown as typeof fetch;
    await expect(extractArticle('https://x.com')).rejects.toThrow();
  });

  it('refuses to fetch a private-range host without hitting the network', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(extractArticle('http://192.168.1.1/admin')).rejects.toThrow();
    await expect(extractArticle('http://127.0.0.1/')).rejects.toThrow();
    await expect(
      extractArticle('http://169.254.169.254/latest/meta-data')
    ).rejects.toThrow();
    await expect(extractArticle('http://localhost:8080/')).rejects.toThrow();
    await expect(extractArticle('http://10.0.0.5/')).rejects.toThrow();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a response whose Content-Length exceeds the cap', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-length' ? '50000000' : null,
      },
      text: () => Promise.resolve('x'),
    }) as unknown as typeof fetch;

    await expect(extractArticle('https://example.com/huge')).rejects.toThrow();
  });
});

describe('looksLikeBotWall', () => {
  it('flags a challenge title regardless of body', () => {
    expect(looksLikeBotWall('some body text', 'Just a moment...')).toBe(true);
    expect(looksLikeBotWall('', 'Attention Required! | Cloudflare')).toBe(true);
  });

  it('flags a short challenge body', () => {
    expect(
      looksLikeBotWall(
        'Please enable JavaScript and cookies to continue browsing this site.'
      )
    ).toBe(true);
    expect(
      looksLikeBotWall('Checking your browser before accessing example.com')
    ).toBe(true);
  });

  it('does not flag a long article that merely mentions verification', () => {
    const article = `Sites often show verify you are human prompts. ${'More analysis. '.repeat(80)}`;
    expect(looksLikeBotWall(article, 'How bot detection works')).toBe(false);
  });

  it('does not flag ordinary short text', () => {
    expect(looksLikeBotWall('Concert tickets on sale from May 10th.')).toBe(
      false
    );
  });
});

describe('extractArticle — external abort signal', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('rejects when the external signal aborts mid-fetch', async () => {
    global.fetch = jest.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(new Error('Aborted'))
          );
        })
    ) as unknown as typeof fetch;

    const controller = new AbortController();
    const pending = extractArticle(
      'https://docs.swmansion.com/x',
      5000,
      controller.signal
    );
    controller.abort();
    await expect(pending).rejects.toThrow('Aborted');
  });

  it('rejects immediately when the signal is already aborted', async () => {
    global.fetch = jest.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        init.signal.aborted
          ? Promise.reject(new Error('Aborted'))
          : Promise.resolve({
              ok: true,
              status: 200,
              statusText: 'OK',
              text: () => Promise.resolve('<html></html>'),
            })
    ) as unknown as typeof fetch;

    const controller = new AbortController();
    controller.abort();
    await expect(
      extractArticle('https://docs.swmansion.com/x', 5000, controller.signal)
    ).rejects.toThrow('Aborted');
  });
});
