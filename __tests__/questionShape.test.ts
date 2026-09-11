import * as fs from 'fs';
import {
  selectRelevantContent,
  webResultsToContext,
} from '../utils/web/webResultsToContext';
import type { WebSearchResult } from '../utils/web/types';

const HISTORY_HEAVY = [
  'It doubled between 1100 and 1300 from 5,000 to 10,000, and in 1400 counted 14,000 inhabitants.',
  'By the early 17th century the population had reached 28,000 inhabitants.',
  'In the 1931 census the city counted 219,000 residents across all districts.',
  'The first fully successful test flight took place on 27 August 2025 after nine earlier attempts.',
  'Kraków is a city in southern Poland with a long history of trade and learning.',
].join('\n');

const FLIGHT_PAGE = (label: string): string =>
  [
    'Bu sayfa havacilik tarihine ayrilmistir ve roket denemeleri hakkinda pek cok ayrinti icerir; okuyucular burada hem eski hem de yeni gorevlerin ayrintilarini bir arada bulabilirler.',
    'Ilk ucus hakkinda genel bilgiler, ucus programi, ucus guvenligi kurallari ve ekibin hazirlik calismalari bu bolumde toplanmistir; konuyla ilgili aciklamalar asagida surmektedir.',
    `${label}: 27.08.2025`,
    'Ekip sonraki gorev icin hazirliklara hemen basladi ve calismalar butun yaz boyunca kesintisiz surdu; yeni denemeler icin gereken parcalar da bu donemde tedarik edildi.',
  ].join('\n');

const FLIGHT_QUESTION = 'Ilk ucus ne zaman gerceklesti?';

describe('passage selection follows the shape of the question', () => {
  it('takes a labelled date whose label answers the question, in a language no word list names', () => {
    const excerpt = selectRelevantContent(
      FLIGHT_PAGE('Ilk ucus tarihi'),
      FLIGHT_QUESTION,
      200
    );
    expect(excerpt).toContain('27.08.2025');
  });

  it('leaves the same date alone when its label answers nothing that was asked', () => {
    const excerpt = selectRelevantContent(
      FLIGHT_PAGE('Sayfa guncelleme'),
      FLIGHT_QUESTION,
      200
    );
    expect(excerpt).not.toContain('27.08.2025');
  });

  it('reaches a dated sentence in running prose through the question own words', () => {
    const excerpt = selectRelevantContent(
      HISTORY_HEAVY,
      'When did the first fully successful flight take place?',
      160
    );
    expect(excerpt).toContain('27 August 2025');
  });

  it('leaves selection alone when the question is not about a date', () => {
    const excerpt = selectRelevantContent(
      HISTORY_HEAVY,
      'Opowiedz o handlu i nauce w mieście',
      160
    );
    expect(excerpt).not.toContain('27 August 2025');
  });
});

describe('what the source row records', () => {
  const result: WebSearchResult = {
    title: 'Pogoda Kraków',
    url: 'https://example.com/1',
    snippet: 'Prognoza na dziś.',
    content: 'Pogoda w Krakowie dzisiaj jest słoneczna. '.repeat(6),
    sourceQuery: 'pogoda Kraków dzisiaj',
  };

  it('keeps the question and the retrieval query apart', () => {
    const out = webResultsToContext(
      [result],
      'pogoda Kraków dzisiaj',
      0,
      4000,
      {
        displayQuery: 'jaka jest pogoda w Krakowie dzisiaj',
      }
    );
    expect(out.sourceDocuments[0]!.query).toBe(
      'jaka jest pogoda w Krakowie dzisiaj'
    );
    expect(out.sourceDocuments[0]!.sourceQuery).toBe('pogoda Kraków dzisiaj');
  });

  it('records no retrieval query for a result that carries none', () => {
    const out = webResultsToContext(
      [{ ...result, sourceQuery: undefined }],
      'pogoda Kraków dzisiaj',
      0,
      4000,
      {
        displayQuery: 'pogoda Kraków dzisiaj',
      }
    );
    expect(out.sourceDocuments[0]!.sourceQuery).toBeUndefined();
  });
});

describe('a page fetched for its prices must give them up', () => {
  const PAGE = fs.readFileSync(
    `${__dirname}/fixtures/skiPassPricing.txt`,
    'utf8'
  );

  it('keeps the amounts for a price question', () => {
    const excerpt = selectRelevantContent(
      PAGE,
      'Ile kosztuje karnet narciarski w Zakopanem?',
      420
    );
    expect(excerpt).toMatch(/\d+,\d{2}\s?PLN/);
  });

  it('does the same for the English form', () => {
    const excerpt = selectRelevantContent(
      PAGE,
      'How much does a ski pass cost in Zakopane?',
      420
    );
    expect(excerpt).toMatch(/\d+,\d{2}\s?PLN/);
  });

  it('leaves selection alone when no price was asked for', () => {
    const excerpt = selectRelevantContent(
      PAGE,
      'W jakich ośrodkach obowiązuje karnet Tatry Super Ski?',
      420
    );
    expect(excerpt).toContain('BIAŁKA');
  });
});
