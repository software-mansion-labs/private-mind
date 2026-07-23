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
