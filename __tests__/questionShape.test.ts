import * as fs from 'fs';
import {
  selectRelevantContent,
  webResultsToContext,
} from '../utils/web/webResultsToContext';
import type { WebSearchResult } from '../utils/web/types';

// Shaped like the Wikipedia page that made the model answer "Kraków ma 4 000
// mieszkańców": a dense run of historical figures, and one sentence with the
// current one.
const HISTORY_HEAVY = [
  'It doubled between 1100 and 1300 from 5,000 to 10,000, and in 1400 counted 14,000 inhabitants.',
  'By the early 17th century the population had reached 28,000 inhabitants.',
  'In the 1931 census the city counted 219,000 residents across all districts.',
  'The first fully successful test flight took place on 27 August 2025 after nine earlier attempts.',
  'Kraków is a city in southern Poland with a long history of trade and learning.',
].join('\n');

describe('passage selection follows the shape of the question', () => {
  it('pulls the dated sentence in for a "when" question', () => {
    const excerpt = selectRelevantContent(
      HISTORY_HEAVY,
      'Kiedy odbył się pierwszy w pełni udany lot?',
      160
    );
    expect(excerpt).toContain('27 August 2025');
  });

  it('does the same for the English form', () => {
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
    expect(out.sourceDocuments[0]!.searchedQuery).toBe('pogoda Kraków dzisiaj');
  });

  it('records no separate retrieval query when the two are the same', () => {
    const out = webResultsToContext(
      [result],
      'pogoda Kraków dzisiaj',
      0,
      4000,
      {
        displayQuery: 'pogoda Kraków dzisiaj',
      }
    );
    expect(out.sourceDocuments[0]!.searchedQuery).toBeUndefined();
  });
});

describe('a page fetched for its prices must give them up', () => {
  // Trimmed from the real szymoszkowa.pl price list. The resort roll-call
  // matches six of the question's words; a "150,00 PLN" cell matches none. On
  // device that put the roll-call in the prompt and no price at all, and the
  // model correctly answered that it had no prices.
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
