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

class FakeXhr {
  static body = '';
  static ok = true;
  static chunkSize: number | null = null;
  static contentType: string | null = null;

  status = 0;
  statusText = '';
  responseText = '';
  readyState = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onprogress: ((event: { loaded: number }) => void) | null = null;
  onreadystatechange: (() => void) | null = null;
  aborted = false;

  open() {}
  setRequestHeader() {}
  getResponseHeader(name: string): string | null {
    return name.toLowerCase() === 'content-type' ? FakeXhr.contentType : null;
  }
  abort() {
    this.aborted = true;
  }
  send() {
    const body = FakeXhr.body;
    this.readyState = 2;
    this.onreadystatechange?.();
    if (this.aborted) return;
    if (FakeXhr.chunkSize) {
      for (let at = 0; at < body.length; at += FakeXhr.chunkSize) {
        if (this.aborted) return;
        this.onprogress?.({
          loaded: Math.min(at + FakeXhr.chunkSize, body.length),
        });
      }
    }
    if (this.aborted) return;
    this.status = FakeXhr.ok ? 200 : 500;
    this.statusText = FakeXhr.ok ? 'OK' : 'Error';
    this.responseText = body;
    this.onload?.();
  }
}

const mockFetch = (body: string, ok = true) => {
  FakeXhr.body = body;
  FakeXhr.ok = ok;
  FakeXhr.chunkSize = null;
  FakeXhr.contentType = null;
  (global as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;
  return FakeXhr;
};

describe('extractArticle', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('extracts main-article text and strips nav/header/footer/scripts', async () => {
    mockFetch(html);
    const article = await extractArticle('https://docs.swmansion.com/x');

    expect(article.text).toContain('smooth animations on the UI thread');
    expect(article.text).not.toContain('Login');
    expect(article.text).not.toContain('Site header junk');
    expect(article.text).not.toContain('Cookie banner');
    expect(article.text).not.toContain('tracking');
  });

  it('drops reference furniture and citation markers', async () => {
    const wiki = `
      <html><body><article>
        <p>Emmanuel Macron has served as President of France since 2017.[ 12 ]</p>
        <p>↑ Noor Haq, Sana (1 July 2023). "Protests are sweeping France".</p>
        <p>Miller, Anna (2020). A real sentence that merely cites.</p>
        <p>Archived from the original on 30 June 2023. Retrieved 1 July 2023.</p>
      </article></body></html>`;
    mockFetch(wiki);
    const article = await extractArticle('https://en.wikipedia.org/wiki/X');
    expect(article.text).toContain('President of France since 2017.');
    expect(article.text).not.toContain('[ 12 ]');
    expect(article.text).not.toContain('Noor Haq');
    expect(article.text).not.toContain('Archived from the original');
    expect(article.text).toContain('A real sentence that merely cites.');
  });

  it('removes data-mw template wikitext before flattening tags', async () => {
    const wiki = `
      <html><body><article>
        <span data-mw='{"parts":[{"template":{"target":"x","params":{"note":{"wt":"<! -- [[Jean Castex]] -->"},"term_start":{"wt":"14 May 2017"}}}}]}'>Macron</span>
        <p>The actual article text about the presidency.</p>
      </article></body></html>`;
    mockFetch(wiki);
    const article = await extractArticle('https://en.wikipedia.org/wiki/X');
    expect(article.text).toContain('The actual article text');
    expect(article.text).not.toContain('term_start');
    expect(article.text).not.toContain('Jean Castex');
  });

  it('prefers the og:title, falling back to the hostname', async () => {
    mockFetch(html);
    const withTitle = await extractArticle('https://docs.swmansion.com/x');
    expect(withTitle.title).toBe('Reanimated Docs');

    mockFetch('<html><body><p>no title here</p></body></html>');
    const noTitle = await extractArticle('https://www.example.com/page');
    expect(noTitle.title).toBe('example.com');
  });

  it('throws on a non-ok response', async () => {
    mockFetch('', false);
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

  it('falls back to JSON-LD when the page body is a JS shell', async () => {
    const body =
      'Pogoda w Krakowie: temperatura 24 stopnie, cisnienie 1021 hPa, wiatr 7 km/h, opady 0 mm przez caly dzien.';
    const shell = `<html><head>
      <title>Pogoda Krakow</title>
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'Article',
        'headline': 'Pogoda Krakow',
        'articleBody': body,
      })}</script>
      </head><body><div id="root"></div></body></html>`;
    mockFetch(shell);

    const article = await extractArticle('https://pogoda.example/krakow');
    expect(article.text).toContain('1021 hPa');
    expect(article.text).toContain('Pogoda Krakow');
  });

  it('falls back to the meta description when there is no JSON-LD', async () => {
    const description =
      'Prognoza pogody dla Krakowa: temperatura 24 stopnie, cisnienie 1021 hPa, wiatr 7 km/h i brak opadow w ciagu dnia.';
    const shell = `<html><head>
      <title>Pogoda</title>
      <meta name="description" content="${description}" />
      </head><body><div id="app"></div></body></html>`;
    mockFetch(shell);

    const article = await extractArticle('https://pogoda.example/krakow');
    expect(article.text).toContain('1021 hPa');
  });

  it('keeps real body text instead of the shorter meta description', async () => {
    mockFetch(html);
    const article = await extractArticle('https://docs.swmansion.com/x');

    expect(article.text).toContain('smooth animations on the UI thread');
  });

  it('returns no text for a challenge page even when it carries metadata', async () => {
    const shell = `<html><head>
      <meta name="description" content="Just a moment while we verify your browser before continuing to the site." />
      </head><body><div id="challenge-form"></div></body></html>`;
    mockFetch(shell);

    const article = await extractArticle('https://blocked.example/x');
    expect(article.text).toBe('');
  });

  it('stops a body that passes the cap, declared or not', async () => {
    mockFetch('x'.repeat(3_000_000));
    FakeXhr.chunkSize = 250_000;
    await expect(extractArticle('https://example.com/huge')).rejects.toThrow(
      /too large/i
    );
  });

  it('stops an oversized body that arrives in one piece', async () => {
    mockFetch('x'.repeat(3_000_000));
    await expect(extractArticle('https://example.com/huge')).rejects.toThrow(
      /too large/i
    );
  });

  it('drops a long run of bare menu labels rendered outside <nav>', async () => {
    const menu = Array.from(
      { length: 12 },
      (_, i) => `<div>Kategoria sklepu ${'x'.repeat((i % 3) + 2)}</div>`
    )
      .join('')
      .replace(/\d/g, '');
    const page = `<html><body>${menu}<article>
      <p>${'GeForce RTX 5080 kosztuje 5 999,00 zł w tym sklepie. '.repeat(10)}</p>
      </article></body></html>`;
    mockFetch(page);

    const article = await extractArticle('https://shop.example/gpu');
    expect(article.text).toContain('5 999,00 zł');
    expect(article.text).not.toContain('Kategoria sklepu');
  });

  it('keeps short data lines — digits and punctuation are not menu chrome', async () => {
    const rows = [
      'Jutro',
      '31°C',
      '19°C',
      'Pojutrze',
      '28°C',
      '17°C',
      'Sobota',
      '25°C',
      '15°C',
    ]
      .map((cell) => `<td>${cell}</td>`)
      .join('');
    const page = `<html><body><article><table><tr>${rows}</tr></table>
      <p>${'Prognoza pogody dla Krakowa na najbliższe dni. '.repeat(6)}</p>
      </article></body></html>`;
    mockFetch(page);

    const article = await extractArticle('https://weather.example/krakow');
    expect(article.text).toContain('31°C');
    expect(article.text).toContain('Jutro');
  });

  it('keeps a full page that merely ships challenge-platform telemetry', async () => {
    const listing = `
      <html><head><title>Karty graficzne RTX 5080 - x-kom.pl</title>
      <script>d.innerHTML="var a=document.createElement('script');a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';"</script>
      </head><body><article>
        <p>${'GeForce RTX 5080 16GB GDDR7, 5 559 zł, dostępny w sklepie. '.repeat(30)}</p>
      </article></body></html>`;
    mockFetch(listing);

    const article = await extractArticle('https://www.x-kom.pl/g-5/c/346');
    expect(article.text).toContain('5 559 zł');
    expect(article.text.length).toBeGreaterThan(800);
  });

  it('still blanks an interstitial: markers plus no real text', async () => {
    const interstitial = `
      <html><head><title>Just a moment...</title></head>
      <body><form id="challenge-form" action="/challenge"></form>
      <p>Checking your browser before accessing example.com</p></body></html>`;
    mockFetch(interstitial);

    const article = await extractArticle('https://blocked.example/page');
    expect(article.text).toBe('');
  });

  it('refuses a PDF on its declared type, before reading the body', async () => {
    const xhr = mockFetch('%PDF-1.5 binary noise'.repeat(50));
    xhr.contentType = 'application/pdf';

    await expect(
      extractArticle('https://arxiv.org/pdf/1706.03762')
    ).rejects.toThrow(/unsupported content type/i);
  });

  it('refuses a binary body that was declared as html', async () => {
    const xhr = mockFetch('%PDF-1.5 binary noise'.repeat(50));
    xhr.contentType = 'text/html; charset=utf-8';

    await expect(extractArticle('https://example.com/report')).rejects.toThrow(
      /binary body/i
    );
  });

  it('still accepts a page whose type is declared with a charset', async () => {
    const xhr = mockFetch(html);
    xhr.contentType = 'text/html; charset=UTF-8';

    const article = await extractArticle('https://docs.swmansion.com/x');
    expect(article.text).toContain('smooth animations on the UI thread');
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
    class HangingXhr extends FakeXhr {
      send() {}
    }
    (global as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest =
      HangingXhr;

    const controller = new AbortController();
    const pending = extractArticle(
      'https://docs.swmansion.com/x',
      5000,
      controller.signal
    );
    controller.abort();
    await expect(pending).rejects.toThrow(/aborted/i);
  });

  it('rejects immediately when the signal is already aborted', async () => {
    mockFetch('<html></html>');

    const controller = new AbortController();
    controller.abort();
    await expect(
      extractArticle('https://docs.swmansion.com/x', 5000, controller.signal)
    ).rejects.toThrow(/aborted/i);
  });
});
