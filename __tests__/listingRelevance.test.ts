import { rankByListingRelevance } from '../utils/web/listingRelevance';
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
});
