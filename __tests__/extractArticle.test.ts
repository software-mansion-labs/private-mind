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

  it('drops a filter rail whose only digits are facet counts and promo badges', async () => {
    const facets = [
      'Gaming i streaming ( 142 )',
      'Laptopy do gier ( 57 )',
      'Podzespoly do gier ( 41 )',
      'Karty graficzne ( 51 )',
      'Filtry',
      'Wyczysc wszystkie',
      'Zasilacz UPS -25% ( 14 )',
      'Monitory iiyama -15% ( 3 )',
      'Raty 0% ( 30 )',
      'Pokaz wszystkie filtry',
    ]
      .map((line) => `<div>${line}</div>`)
      .join('');
    const page = `<html><body>${facets}<article>
      <p>${'GeForce RTX 5080 kosztuje 6 499,00 zl w tym sklepie. '.repeat(10)}</p>
      </article></body></html>`;
    mockFetch(page);

    const article = await extractArticle('https://shop.example/gpu');
    expect(article.text).toContain('6 499,00 zl');
    expect(article.text).not.toContain('Karty graficzne');
    expect(article.text).not.toContain('Zasilacz UPS');
  });

  it('keeps a run of figure-only cells, which carry no label to strip', async () => {
    const cells = ['12%', '31%', '48%', '55%', '61%', '70%', '82%', '91%']
      .map((cell) => `<td>${cell}</td>`)
      .join('');
    const page = `<html><body><article><table><tr>${cells}</tr></table>
      <p>${'Szansa opadow w kolejnych godzinach dnia. '.repeat(6)}</p>
      </article></body></html>`;
    mockFetch(page);

    const article = await extractArticle('https://weather.example/rain');
    expect(article.text).toContain('91%');
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

describe('extractArticle — structured product data', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  const productPage = (ldJson: unknown) => `<html><head>
    <title>RTX 4070 - Allegro</title>
    <script type="application/ld+json">${JSON.stringify(ldJson)}</script>
    </head><body><article><p>${'Karta graficzna do gier w wysokiej rozdzielczości. '.repeat(6)}</p></article></body></html>`;

  it('extracts name, price, currency and normalized availability from a single Product/Offer', async () => {
    mockFetch(
      productPage({
        '@context': 'https://schema.org',
        '@type': 'Product',
        'name': 'RTX 4070',
        'offers': {
          '@type': 'Offer',
          'price': '2199.00',
          'priceCurrency': 'PLN',
          'availability': 'https://schema.org/InStock',
        },
      })
    );

    const article = await extractArticle('https://allegro.pl/oferta/rtx-4070');
    expect(article.product).toEqual({
      name: 'RTX 4070',
      price: '2199.00',
      currency: 'PLN',
      availability: 'in stock',
    });
  });

  it('accepts an array-wrapped offer, taking the single agreeing price', async () => {
    mockFetch(
      productPage({
        '@type': 'Product',
        'name': 'RTX 4070',
        'offers': [
          { '@type': 'Offer', 'price': '2349', 'priceCurrency': 'PLN' },
        ],
      })
    );

    const article = await extractArticle('https://ceneo.pl/rtx-4070');
    expect(article.product).toEqual({
      name: 'RTX 4070',
      price: '2349',
      currency: 'PLN',
      availability: undefined,
    });
  });

  it('keeps only the name when several offers disagree on price — no single answer to trust', async () => {
    mockFetch(
      productPage({
        '@type': 'Product',
        'name': 'RTX 4070',
        'offers': [
          { '@type': 'Offer', 'price': '2199', 'priceCurrency': 'PLN' },
          { '@type': 'Offer', 'price': '2599', 'priceCurrency': 'PLN' },
        ],
      })
    );

    const article = await extractArticle('https://allegro.pl/oferta/rtx-4070');
    expect(article.product).toEqual({ name: 'RTX 4070' });
  });

  it('leaves product unset for a category page listing several distinct products', async () => {
    mockFetch(
      productPage([
        {
          '@type': 'Product',
          'name': 'RTX 4070',
          'offers': { price: '2199', priceCurrency: 'PLN' },
        },
        {
          '@type': 'Product',
          'name': 'RTX 4060',
          'offers': { price: '1499', priceCurrency: 'PLN' },
        },
      ])
    );

    const article = await extractArticle(
      'https://allegro.pl/kategoria/karty-graficzne'
    );
    expect(article.product).toBeUndefined();
  });

  it('ignores a lone Product node when the page declares itself a non-product page (F20)', async () => {
    const html = `<html><head>
      <title>Mieszkania do wynajęcia - Warszawa</title>
      <meta property="og:type" content="website" />
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'Product',
        'name': 'Kawalerka 40m2 Mokotów',
        'offers': { price: '2800', priceCurrency: 'PLN' },
      })}</script>
      </head><body><article><p>${'Wiele ogłoszeń wynajmu mieszkań w Warszawie. '.repeat(6)}</p></article></body></html>`;
    mockFetch(html);

    const article = await extractArticle(
      'https://olx.pl/nieruchomosci/wynajem'
    );
    expect(article.product).toBeUndefined();
  });

  it('still trusts a lone Product node when og:type is absent', async () => {
    mockFetch(
      productPage({
        '@type': 'Product',
        'name': 'RTX 4070',
        'offers': { price: '2199', priceCurrency: 'PLN' },
      })
    );
    const article = await extractArticle('https://allegro.pl/oferta/rtx-4070');
    expect(article.product?.price).toBe('2199');
  });

  it('still trusts a lone Product node when og:type explicitly says product', async () => {
    const html = `<html><head>
      <title>RTX 4070 - Allegro</title>
      <meta property="og:type" content="product" />
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'Product',
        'name': 'RTX 4070',
        'offers': { price: '2199', priceCurrency: 'PLN' },
      })}</script>
      </head><body><article><p>${'Karta graficzna do gier. '.repeat(6)}</p></article></body></html>`;
    mockFetch(html);
    const article = await extractArticle('https://allegro.pl/oferta/rtx-4070');
    expect(article.product?.price).toBe('2199');
  });

  it('falls back to Open Graph product meta tags when there is no Product JSON-LD', async () => {
    const page = `<html><head>
      <title>Nike Air Max 90</title>
      <meta property="product:price:amount" content="649.99" />
      <meta property="product:price:currency" content="PLN" />
      </head><body><article><p>${'Buty sportowe do biegania. '.repeat(6)}</p></article></body></html>`;
    mockFetch(page);

    const article = await extractArticle('https://nike.com/air-max-90');
    expect(article.product).toEqual({ price: '649.99', currency: 'PLN' });
  });

  it('leaves product undefined when the page has neither JSON-LD Product nor OG product tags', async () => {
    mockFetch(html);
    const article = await extractArticle('https://docs.swmansion.com/x');
    expect(article.product).toBeUndefined();
  });

  it('finds the Product node nested inside a @graph array', async () => {
    mockFetch(
      productPage({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebPage', 'name': 'RTX 4070 - Allegro' },
          {
            '@type': 'Product',
            'name': 'RTX 4070',
            'offers': { price: '2199', priceCurrency: 'PLN' },
          },
        ],
      })
    );

    const article = await extractArticle('https://allegro.pl/oferta/rtx-4070');
    expect(article.product).toEqual({
      name: 'RTX 4070',
      price: '2199',
      currency: 'PLN',
      availability: undefined,
    });
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

describe('sibling blocks group into records (live-found: Nowy Sącz weather)', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  const forecast = `
<html><body><article>
  <h1>Pogoda Jutro, Nowy Sącz</h1>
  <table>
    <tr><td>Jutro</td><td>22°C</td><td>12°C</td></tr>
    <tr><td>Piątek</td><td>24°C</td><td>18°C</td></tr>
  </table>
</article></body></html>`;

  it('keeps each row on its own line instead of gluing them into one run', async () => {
    mockFetch(forecast);
    const article = await extractArticle('https://pogoda.interia.pl/x');

    expect(article.text).not.toContain('12°C Piątek');
    const rows = article.text.split('\n').map((line) => line.trim());
    expect(rows).toContain('Jutro | 22°C | 12°C');
    expect(rows).toContain('Piątek | 24°C | 18°C');
  });

  it('leaves no dangling cell separator at either end of a row', async () => {
    mockFetch(forecast);
    const article = await extractArticle('https://pogoda.interia.pl/x');

    expect(article.text).not.toMatch(/\|\s*\n/);
    expect(article.text).not.toMatch(/\n\s*\|/);
    expect(article.text).not.toMatch(/\|\s*\|/);
  });
});

describe('record grouping generalises past <table>', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  const page = (body: string) =>
    `<html><body><article>${body}</article></body></html>`;

  it('groups a div grid, the layout most forecast and price pages actually use', async () => {
    mockFetch(
      page(`
        <div><div>Jutro</div><div>22°C</div><div>12°C</div></div>
        <div><div>Piątek</div><div>24°C</div><div>18°C</div></div>`)
    );
    const article = await extractArticle('https://example.com/x');
    const lines = article.text.split('\n').map((line) => line.trim());

    expect(lines).toContain('Jutro | 22°C | 12°C');
    expect(lines).toContain('Piątek | 24°C | 18°C');
  });

  it('groups list items the same way as divs', async () => {
    mockFetch(
      page(`
        <ul><li>RAM</li><li>16 GB</li></ul>
        <ul><li>Dysk</li><li>512 GB</li></ul>`)
    );
    const article = await extractArticle('https://example.com/x');
    const lines = article.text.split('\n').map((line) => line.trim());

    expect(lines).toContain('RAM | 16 GB');
    expect(lines).toContain('Dysk | 512 GB');
  });

  it('keeps a table row whole even when one cell is long', async () => {
    const long = 'Bardzo dluga nazwa produktu w jednej komorce tabeli cenowej';
    mockFetch(page(`<table><tr><td>${long}</td><td>2499 zl</td></tr></table>`));
    const article = await extractArticle('https://example.com/x');

    expect(article.text).toContain(`${long} | 2499 zl`);
  });

  it('never glues prose paragraphs together', async () => {
    mockFetch(
      page(`
        <div>
          <p>Pierwszy akapit tekstu, ktory jest wystarczajaco dlugi.</p>
          <p>Drugi akapit tekstu, rowniez odpowiednio dlugi.</p>
        </div>`)
    );
    const article = await extractArticle('https://example.com/x');

    expect(article.text).not.toContain('|');
    expect(article.text.split('\n').length).toBeGreaterThan(1);
  });

  it('leaves a bare label menu ungrouped so the menu filter can still drop it', async () => {
    const items = [
      'Strona glowna',
      'O nas',
      'Kontakt',
      'Kariera',
      'Blog',
      'Pomoc',
      'Regulamin',
      'Prywatnosc',
    ]
      .map((label) => `<li>${label}</li>`)
      .join('');
    mockFetch(page(`<ul>${items}</ul><p>Wlasciwa tresc artykulu tutaj.</p>`));
    const article = await extractArticle('https://example.com/x');

    expect(article.text).not.toContain('Strona glowna | O nas');
    expect(article.text).not.toContain('Kontakt');
    expect(article.text).toContain('Wlasciwa tresc artykulu tutaj.');
  });

  it('does not let facet counts promote a filter rail into a record', async () => {
    const items = ['Buty (12)', 'Kurtki (8)', 'Spodnie (30)']
      .map((label) => `<li>${label}</li>`)
      .join('');
    mockFetch(page(`<ul>${items}</ul>`));
    const article = await extractArticle('https://example.com/x');

    expect(article.text).not.toContain('Buty (12) | Kurtki (8)');
  });
});
