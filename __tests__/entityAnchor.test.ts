import {
  anchorTerms,
  rankByListingRelevance,
} from '../utils/web/listingRelevance';
import type { WebSearchResult } from '../utils/web/types';

const result = (title: string, snippet = ''): WebSearchResult => ({
  title,
  url: `https://example.com/${encodeURIComponent(title.slice(0, 20))}`,
  snippet,
});

describe('anchorTerms', () => {
  // Anchors are stemmed the same way the other query terms are, so they match
  // inflected forms in the results.
  it('takes names away from the opening word, and anything with a digit', () => {
    expect(anchorTerms('Kiedy odbył się pierwszy udany lot Starship?')).toEqual(
      ['starsh']
    );
    expect(anchorTerms('Ile kosztuje jeden lot Falcon 9?')).toEqual([
      'falc',
      '9',
    ]);
  });

  it('ignores the sentence-initial capital, which every sentence has', () => {
    expect(anchorTerms('Pogoda w Zakopanem')).toEqual(['zakopan']);
    expect(anchorTerms('kiedy jest następny mecz')).toEqual([]);
  });

  it('finds no anchors in a script without letter case', () => {
    expect(anchorTerms('दिल्ली में आज का मौसम कैसा है')).toEqual([]);
  });
});

describe('ranking anchors on the question subject', () => {
  // The turn-7 failure on device: five results, three of them about a heart
  // transplant and a V-2 rocket because they share the Polish frame
  // "pierwszy udany ... odbył się". The transplant page ranked first and was
  // used as a source; the answer invented a launch date.
  it('puts Starship above pages that only share the sentence frame', () => {
    const question = 'Kiedy odbył się pierwszy w pełni udany lot Starship?';
    const ranked = rankByListingRelevance(
      [
        result(
          'Pierwszy, udany przeszczep serca w Polsce odbył się 5 listopada 1985',
          'Pierwszy udany przeszczep serca w Polsce odbył się w Zabrzu.'
        ),
        result(
          "Starship's Thirteenth Flight Test - SpaceX",
          'Starship completed its thirteenth flight test.'
        ),
        result('SpaceX - Launches', 'Upcoming and past Starship launches.'),
        result(
          '81 lat temu odbył się pierwszy w pełni udany lot rakiety V-2',
          'Pierwszy w pełni udany lot rakiety V-2 odbył się w 1942 roku.'
        ),
        result(
          'Asystował przy pierwszym udanym przeszczepie serca w Polsce',
          'Wspomnienia o pierwszym udanym przeszczepie serca.'
        ),
      ],
      question
    );

    expect(ranked[0]!.title).toContain('Starship');
    const transplantAt = ranked.findIndex((r) =>
      r.title.includes('przeszczep')
    );
    expect(transplantAt).toBeGreaterThan(1);
  });

  // The turn-9 failure: the answer was in a title the pipeline already held,
  // but that result ranked third and the fetch budget is two.
  it('lifts the result whose title carries both the subject and a figure', () => {
    const ranked = rankByListingRelevance(
      [
        result(
          'Rocket Launch Cost: $54,000 to $3,000 per Kg (2026)',
          'How launch costs fell over time.'
        ),
        result(
          'How Much Does It Cost to Launch a Satellite? 2026 Prices by Rocket',
          'Satellite launch pricing overview.'
        ),
        result(
          'SpaceX Increases Falcon 9 Launch Prices to $74M',
          'SpaceX raised the list price of a Falcon 9 launch.'
        ),
        result(
          'Launch Cost Comparison 2026: Falcon 9 vs Vulcan vs New Glenn',
          'Comparing launch vehicles.'
        ),
        result(
          'Space Launch Cost Comparison 2026: Prices by Vehicle & Provider',
          'Provider pricing table.'
        ),
      ],
      'Ile kosztuje jeden lot Falcon 9?'
    );

    expect(ranked[0]!.title).toContain('$74M');
  });

  it('does not match a short anchor inside a longer number', () => {
    const ranked = rankByListingRelevance(
      [
        result('Rok 1999 w historii lotnictwa', 'Wydarzenia roku 1999.'),
        result('Falcon 9 — dane techniczne', 'Specyfikacja rakiety Falcon 9.'),
      ],
      'Ile kosztuje jeden lot Falcon 9?'
    );
    expect(ranked[0]!.title).toContain('Falcon 9');
  });

  it('leaves ranking alone when nothing matches an anchor', () => {
    const input = [
      result('Zupełnie inna strona', 'Nic wspólnego z pytaniem.'),
      result('Druga inna strona', 'Też nic wspólnego.'),
    ];
    const ranked = rankByListingRelevance(input, 'Ile kosztuje Falcon 9?');
    expect(ranked.map((r) => r.title)).toEqual(input.map((r) => r.title));
  });
});

describe('a figure that answers a quantity question', () => {
  // Measured on device: the two pages ranked first were a voivodship
  // statistics bulletin and a page with no figures at all, so those were the
  // two that got fetched. The three whose snippets carried the population
  // ranked third to fifth and were never read.
  it('lifts the page whose title states the number over a number-dense one', () => {
    const ranked = rankByListingRelevance(
      [
        result(
          'Statistical Office in Krakow',
          'Statistical bulletin of Małopolskie Voivodship quarter 2/2026, population as of 31.12.2025 - 3,429.3 thousand, 10,078.50, 553.7, 11,920, 523,858'
        ),
        result(
          'Kraków w liczbach - Oficjalny serwis miejski',
          'Opracowania publikowane od 2005 roku zawierają najważniejsze dane o Krakowie w kolejnych latach.'
        ),
        result(
          'Kraków Population 2026 — 804,237 People | Growth & Area',
          'The population of Kraków, Poland is 804,237 in 2026. Explore live stats and growth rate.'
        ),
      ],
      'Ile mieszkancow ma Krakow?'
    );

    expect(ranked[0]!.title).toContain('804,237');
  });

  it('does not let a listicle number win when no quantity was asked', () => {
    const ranked = rankByListingRelevance(
      [
        result(
          'Atrakcje Krakowa - 50 000 miejsc wartych zobaczenia',
          'Lista atrakcji.'
        ),
        result('Wawel - Zamek Królewski', 'Wawel to symbol Krakowa.'),
      ],
      'A jakie sa tam najwieksze atrakcje turystyczne?'
    );
    expect(ranked[0]!.title).toContain('Atrakcje Krakowa');
  });

  it('treats a bare year as no answer at all', () => {
    const ranked = rankByListingRelevance(
      [
        result('Kraków w 2026 roku', 'Wydarzenia w Krakowie w 2026.'),
        result('Kraków — 804,237 mieszkańców', 'Liczba ludności Krakowa.'),
      ],
      'Ile mieszkancow ma Krakow?'
    );
    expect(ranked[0]!.title).toContain('804,237');
  });
});
