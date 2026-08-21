import {
  rankByListingRelevance,
  fairRankByListingRelevance,
} from '../utils/web/listingRelevance';
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

  it('drops an all-time record page once a real this-year page is available', () => {
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
      'Kto zdobyl najwiecej bramek w reprezentacji Polski w tym roku'
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.url).toBe(
      'https://footystats.org/statistics-poland-national-team'
    );
  });

  it('drops every all-time page for a this-year record question rather than falling back to them', () => {
    const results = [
      result({
        url: 'https://www.transfermarkt.pl/spieler/rekordnationalspieler/statistik',
        title: 'Najwięcej występów w reprezentacji | Transfermarkt',
      }),
      result({
        url: 'https://sport.tvp.pl/najlepsi-strzelcy',
        title: 'Najlepsi strzelcy reprezentacji narodowych wszech czasów',
      }),
    ];
    const ranked = rankByListingRelevance(
      results,
      'Kto zdobyl najwiecej bramek w reprezentacji Polski w tym roku'
    );
    expect(ranked).toHaveLength(0);
  });

  it('drops an English "record scorers" all-time page for a this-year question', () => {
    const ranked = rankByListingRelevance(
      [
        result({
          url: 'https://www.transfermarkt.com/poland/rekordtorschuetzen',
          title: 'Poland – Record goal scorers | Transfermarkt',
        }),
        result({
          url: 'https://footystats.org/statistics-poland-national-team',
          title: 'Poland National Team Stats, Form & Top Scorers 2026',
        }),
      ],
      'Kto zdobyl najwiecej bramek w reprezentacji Polski w tym roku'
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.url).toBe(
      'https://footystats.org/statistics-poland-national-team'
    );
  });

  it('does not drop an all-time record page for a plain all-time question', () => {
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

  it('drops an all-time single-game-records page for a "who scored most in that game" follow-up', () => {
    const results = [
      result({
        url: 'https://www.basketball-reference.com/leaders/pts_single_game.html',
        title:
          'NBA Single Game Leaders and Records for Points | Basketball-Reference.com',
      }),
    ];
    const ranked = rankByListingRelevance(
      results,
      'Who was the top scorer in that game?'
    );
    expect(ranked).toHaveLength(0);
  });

  it('drops an all-time page once a real game-specific page is available for an "in that game" follow-up', () => {
    const ranked = rankByListingRelevance(
      [
        result({
          url: 'https://www.basketball-reference.com/leaders/pts_single_game.html',
          title:
            'NBA Single Game Leaders and Records for Points | Basketball-Reference.com',
        }),
        result({
          url: 'https://www.espn.com/boxscore/401585123',
          title: 'Rockets 99-93 Lakers (Apr 29, 2026) Box Score - ESPN',
        }),
      ],
      'Who was the top scorer in that game?'
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.url).toContain('boxscore');
  });

  it('does not drop an all-time page for a superlative question with no event/period scope at all', () => {
    const results = [
      result({
        url: 'https://www.basketball-reference.com/leaders/pts_single_game.html',
        title:
          'NBA Single Game Leaders and Records for Points | Basketball-Reference.com',
      }),
      result({
        url: 'https://example.com/unrelated',
        title: 'Unrelated page',
      }),
    ];
    const ranked = rankByListingRelevance(
      results,
      'Who scored the most points in a single NBA game ever?'
    );
    expect(ranked).toHaveLength(2);
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
