import {
  rankByListingRelevance,
  fairRankByListingRelevance,
  scopeYearsOf,
  looksLikeHistoricalRoster,
} from '../utils/web/listingRelevance';
import { namesATimePeriod } from '../utils/web/buildSearchQuery';
import type { WebSearchResult } from '../utils/web/types';

const result = (over: Partial<WebSearchResult>): WebSearchResult => ({
  title: '',
  url: 'https://example.com',
  snippet: '',
  ...over,
});

describe('rankByListingRelevance', () => {
  it('puts the page shaped like the question above background pages', () => {
    const ranked = rankByListingRelevance(
      [
        result({
          url: 'https://pl.wikipedia.org/wiki/Kanclerze_Niemiec',
          title: 'Kanclerze Niemiec - Wikipedia',
        }),
        result({
          url: 'https://pl.wikipedia.org/wiki/Kanclerz_RFN',
          title: 'Kanclerz Republiki Federalnej Niemiec - Wikipedia',
        }),
        result({
          url: 'https://radiospacja.pl/kto-jest-kanclerzem',
          title: 'Kto jest kanclerzem niemiec - Friedrich Merz w 2026 roku',
        }),
      ],
      'Kto jest kanclerzem Niemiec?'
    );
    expect(ranked[0]!.url).toBe('https://radiospacja.pl/kto-jest-kanclerzem');
  });

  it('keeps the engine order when the listings carry no signal', () => {
    const results = [
      result({ url: 'https://a.com', title: 'Alpha' }),
      result({ url: 'https://b.com', title: 'Beta' }),
    ];
    expect(
      rankByListingRelevance(results, 'query about something else')
    ).toEqual(results);
  });

  it('keeps the engine order without a query', () => {
    const results = [
      result({ url: 'https://a.com', title: 'Alpha' }),
      result({ url: 'https://b.com', title: 'Beta' }),
    ];
    expect(rankByListingRelevance(results, undefined)).toEqual(results);
    expect(rankByListingRelevance(results, '  ')).toEqual(results);
  });

  it('keeps the engine’s first pick within fetch reach', () => {
    const ranked = rankByListingRelevance(
      [
        result({
          url: 'https://pl.wikipedia.org/wiki/Lista',
          title: 'Lista prezydentów Polski - Wikipedia',
        }),
        result({
          url: 'https://farm1.pl',
          title: 'Kto jest prezydentem Polski? Aktualne informacje',
        }),
        result({
          url: 'https://farm2.pl',
          title: 'Kto jest teraz prezydentem Polski? Poznaj lidera',
        }),
      ],
      'Kto jest prezydentem Polski?'
    );
    expect(
      ranked.map((r) => r.url).indexOf('https://pl.wikipedia.org/wiki/Lista')
    ).toBeLessThanOrEqual(1);
  });

  it('scores the snippet too, not only the title', () => {
    const ranked = rankByListingRelevance(
      [
        result({ url: 'https://a.com', title: 'Niemcy dzisiaj' }),
        result({
          url: 'https://b.com',
          title: 'Polityka',
          snippet: 'Kto jest kanclerzem Niemiec w tym roku',
        }),
      ],
      'kto jest kanclerzem'
    );
    expect(ranked[0]!.url).toBe('https://b.com');
  });

  it('prefers a listing that already shows a price over one that only describes the page', () => {
    const ranked = rankByListingRelevance(
      [
        result({
          url: 'https://a.com',
          title:
            'Ethereum ETH (ETH-USD) Live Price, News, Chart & Price History',
        }),
        result({
          url: 'https://b.com',
          title: 'Ethereum Price: $1,898.04 (-0.20%) | ETH Chart & Analysis',
        }),
      ],
      'ethereum price today'
    );
    expect(ranked[0]!.url).toBe('https://b.com');
  });

  it('drops a cross-asset conversion page once a real price page is available', () => {
    const ranked = rankByListingRelevance(
      [
        result({
          url: 'https://finance.yahoo.com/quote/BTC-ETH/',
          title: 'Bitcoin BTC (BTC-ETH) Live Price, News, Chart',
        }),
        result({
          url: 'https://coinmarketcap.com/currencies/bitcoin/btc/eth/',
          title: 'Calculate Bitcoin to Ethereum Live Today (BTC-ETH)',
        }),
        result({
          url: 'https://coinmarketcap.com/currencies/bitcoin/',
          title: 'Bitcoin price today, BTC to USD live price',
        }),
      ],
      'bitcoin price today'
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.url).toBe(
      'https://coinmarketcap.com/currencies/bitcoin/'
    );
  });

  it('keeps cross-asset pages when nothing else was found', () => {
    const results = [
      result({
        url: 'https://finance.yahoo.com/quote/BTC-ETH/',
        title: 'Bitcoin BTC (BTC-ETH) Live Price, News, Chart',
      }),
      result({
        url: 'https://www.google.com/finance/quote/ETH-BTC',
        title: 'Ether (ETH) Price, Real-time Quote & News',
      }),
    ];
    const ranked = rankByListingRelevance(results, 'bitcoin price today');
    expect(ranked).toHaveLength(2);
  });

  it('puts the page that names the scoped year first, whatever language the all-time page speaks', () => {
    const ranked = rankByListingRelevance(
      [
        result({
          url: 'https://www.transfermarkt.pl/spieler/rekordnationalspieler/statistik',
          title: 'Najwięcej występów w reprezentacji | Transfermarkt',
        }),
        result({
          url: 'https://footystats.org/statistics-poland-national-team',
          title: 'Poland National Team Stats, Form & Top Scorers 2026',
        }),
      ],
      'najwięcej bramek reprezentacja Polski',
      { scopeYears: ['2026'] }
    );
    expect(ranked[0]!.url).toBe(
      'https://footystats.org/statistics-poland-national-team'
    );
  });

  it('reads the year from the URL or the snippet too', () => {
    const ranked = rankByListingRelevance(
      [
        result({
          url: 'https://sport.tvp.pl/najlepsi-strzelcy',
          title: 'Najlepsi strzelcy reprezentacji narodowych wszech czasów',
        }),
        result({
          url: 'https://sport.tvp.pl/strzelcy/sezon-2026',
          title: 'Strzelcy reprezentacji w bieżącym sezonie',
        }),
      ],
      'strzelcy reprezentacji',
      { scopeYears: ['2026'] }
    );
    expect(ranked[0]!.url).toBe('https://sport.tvp.pl/strzelcy/sezon-2026');
  });

  it('leaves the order alone when no listing names the scoped year', () => {
    const results = [
      result({ url: 'https://a.com', title: 'Strzelcy reprezentacji Polski' }),
      result({ url: 'https://b.com', title: 'Reprezentacja Polski strzelcy' }),
    ];
    expect(
      rankByListingRelevance(results, 'strzelcy reprezentacji Polski', {
        scopeYears: ['2026'],
      })
    ).toEqual(results);
  });

  it('keeps every page for a question that carries no year', () => {
    const results = [
      result({
        url: 'https://www.transfermarkt.pl/spieler/rekordnationalspieler/statistik',
        title: 'Najwięcej występów w reprezentacji | Transfermarkt',
      }),
      result({
        url: 'https://example.com/unrelated',
        title: 'Unrelated page',
      }),
    ];
    const ranked = rankByListingRelevance(
      results,
      'Kto zdobyl najwiecej bramek w reprezentacji Polski w historii'
    );
    expect(ranked).toHaveLength(2);
  });

  it('gives the title figure its bonus from the intent kind, not from the question’s wording', () => {
    const results = [
      result({ url: 'https://a.com', title: 'Warsaw population and history' }),
      result({
        url: 'https://b.com',
        title: 'Warsaw Population 2026 — 1,862,402 People',
      }),
    ];
    expect(
      rankByListingRelevance(results, 'Einwohner Warschau', {
        kind: 'fact',
      })[0]!.url
    ).toBe('https://b.com');
    expect(
      rankByListingRelevance(results, 'Einwohner Warschau', { kind: 'howto' })
    ).toEqual(results);
  });
});

describe('scopeYearsOf', () => {
  it('collects the years the planner put into its queries', () => {
    expect(
      scopeYearsOf(['strzelcy Ekstraklasa sezon 2025/26', 'cena iPhone 17'])
    ).toEqual(['2025']);
  });

  it('is empty when no query names a year', () => {
    expect(scopeYearsOf(['pogoda Kraków dzisiaj'])).toEqual([]);
  });
});

describe('fairRankByListingRelevance', () => {
  const btc = (n: number) =>
    result({ url: `https://btc${n}.com`, title: `Bitcoin listing ${n} price` });
  const eth = (n: number) =>
    result({
      url: `https://eth${n}.com`,
      title: `Ethereum listing ${n} price`,
    });

  it('gives every query group a slot before any group gets a second one', () => {
    const bitcoinGroup = [btc(1), btc(2), btc(3), btc(4), btc(5)];
    const ethereumGroup = [eth(1)];
    const capped = fairRankByListingRelevance(
      [bitcoinGroup, ethereumGroup],
      'bitcoin ethereum price',
      5
    );
    expect(capped.some((r) => r.url === 'https://eth1.com')).toBe(true);
    expect(capped).toHaveLength(5);
  });

  it('does not let one strong group crowd out a weaker one entirely', () => {
    const bitcoinGroup = [btc(1), btc(2), btc(3), btc(4), btc(5)];
    const ethereumGroup = [eth(1), eth(2), eth(3), eth(4), eth(5)];
    const capped = fairRankByListingRelevance(
      [bitcoinGroup, ethereumGroup],
      'bitcoin ethereum price',
      5
    );
    const ethCount = capped.filter((r) =>
      r.url.startsWith('https://eth')
    ).length;
    expect(ethCount).toBeGreaterThanOrEqual(2);
  });

  it('falls back to plain ranking when there is only one non-empty group', () => {
    const bitcoinGroup = [btc(1), btc(2), btc(3)];
    const capped = fairRankByListingRelevance(
      [bitcoinGroup, []],
      'bitcoin price',
      2
    );
    expect(capped).toHaveLength(2);
    expect(capped.every((r) => r.url.startsWith('https://btc'))).toBe(true);
  });

  it('handles all-empty groups without throwing', () => {
    expect(fairRankByListingRelevance([[], []], 'anything', 5)).toEqual([]);
  });
});

describe('a question about who holds a position now', () => {
  const roster = {
    title: 'Prezydenci USA - pełna lista od 1789 roku do dziś',
    url: 'https://historia.example.pl/prezydenci',
    snippet:
      'Wszyscy prezydenci Stanów Zjednoczonych w porządku chronologicznym.',
  };
  const current = {
    title: 'Prezydent USA - kto obecnie sprawuje urząd',
    url: 'https://news.example.pl/prezydent',
    snippet: 'Aktualny prezydent Stanów Zjednoczonych i jego kadencja.',
  };

  it('recognises a title that announces a historical roster', () => {
    expect(looksLikeHistoricalRoster(roster.title)).toBe(true);
    expect(
      looksLikeHistoricalRoster(
        'FIFA World Cup Winners Full List From 1930 to 2026'
      )
    ).toBe(true);
  });

  it('leaves a title about the present alone', () => {
    expect(looksLikeHistoricalRoster(current.title)).toBe(false);
  });

  it('demotes the roster below the page about the present (Pixel: prezydent USA)', () => {
    const ranked = rankByListingRelevance(
      [roster, current],
      'Kto jest aktualnie prezydentem USA?',
      { currentState: true }
    );

    expect(ranked[0]!.title).toBe(current.title);
  });

  it('is the penalty, not the wording, that puts the holder above the roster', () => {
    const enumerating = {
      title: 'Prezydenci Stanow Zjednoczonych 1789-2026',
      url: 'https://wiki.example/lista',
      snippet:
        'Lista prezydentow Stanow Zjednoczonych, kadencje, partie, prezydent po prezydencie.',
    };
    const holder = {
      title: 'Donald Trump',
      url: 'https://wiki.example/osoba',
      snippet: 'Prezydent Stanow Zjednoczonych.',
    };
    const question = 'Kto jest prezydentem USA?';

    expect(
      rankByListingRelevance([enumerating, holder], question, {})[0]!.title
    ).toBe(enumerating.title);
    expect(
      rankByListingRelevance([enumerating, holder], question, {
        currentState: true,
      })[0]!.title
    ).toBe(holder.title);
  });

  it('reads a roster title in any language, because it reads the years', () => {
    expect(
      looksLikeHistoricalRoster(
        'Liste der Bundeskanzler Deutschlands seit 1949'
      )
    ).toBe(true);
    expect(looksLikeHistoricalRoster('Presidentes do Brasil desde 1889')).toBe(
      true
    );
    expect(
      looksLikeHistoricalRoster('日本の内閣総理大臣一覧 1885年から2026年まで')
    ).toBe(true);
  });

  it('reads a span of recent years as a roster, with no year old enough', () => {
    expect(looksLikeHistoricalRoster('Премьер-министры 2005-2026')).toBe(true);
  });

  it('leaves a title that only names the present alone', () => {
    expect(
      looksLikeHistoricalRoster('Bundeskanzler von Deutschland 2026')
    ).toBe(false);
  });

  it('leaves two nearby years alone, as one tenure can span them', () => {
    expect(looksLikeHistoricalRoster('World Cup hosts 2022 and 2026')).toBe(
      false
    );
  });

  describe('the gate that decides a question is about the present', () => {
    const list = {
      title: 'Liste der Bundeskanzler Deutschlands 1949-2026',
      url: 'https://wiki.example/liste',
      snippet: 'Alle Bundeskanzler Deutschlands mit ihren Amtszeiten.',
    };
    const holder = {
      title: 'Bundeskanzler',
      url: 'https://wiki.example/person',
      snippet: 'Politiker in Deutschland.',
    };
    const rankFor = (question: string) =>
      rankByListingRelevance([list, holder], question, {
        currentState: !namesATimePeriod(question),
      }).map((entry) => entry.title);

    it('demotes the roster for a question no phrase list ever covered', () => {
      expect(rankFor('Wer ist Bundeskanzler von Deutschland?')[0]).toBe(
        holder.title
      );
    });

    it('leaves the roster on top once the question names a period', () => {
      expect(
        rankFor('Welche Bundeskanzler regierten im XX. Jahrhundert?')[0]
      ).toBe(list.title);
    });
  });

  describe('the freshness bonus', () => {
    const dated = {
      title: 'Bundeskanzler 2026',
      url: 'https://news.example/2026',
      snippet: 'Wer das Amt fuehrt.',
    };
    const undated = {
      title: 'Bundeskanzler',
      url: 'https://wiki.example/amt',
      snippet: 'Wer das Amt fuehrt.',
    };

    it('lifts the page that names the current year', () => {
      expect(
        rankByListingRelevance([undated, dated], 'Wer ist Bundeskanzler?', {
          freshYear: '2026',
        })[0]!.title
      ).toBe(dated.title);
    });

    it('never pushes a page down for lacking the year', () => {
      const withoutBonus = rankByListingRelevance(
        [undated, dated],
        'Wer ist Bundeskanzler?',
        {}
      );
      const withBonus = rankByListingRelevance(
        [undated, dated],
        'Wer ist Bundeskanzler?',
        { freshYear: '2026' }
      );
      expect(withBonus).toContain(withoutBonus[0]);
      expect(withBonus).toHaveLength(withoutBonus.length);
    });
  });

  it('leaves the ordering alone when the question is not about the present', () => {
    const ranked = rankByListingRelevance(
      [roster, current],
      'Którzy prezydenci USA rządzili w XIX wieku?',
      {}
    );

    expect(ranked[0]!.title).toBe(roster.title);
  });
});
