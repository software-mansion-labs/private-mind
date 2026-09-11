import { webResultsToContext } from '../utils/web/webResultsToContext';
import type { WebSearchResult } from '../utils/web/types';

const result = (
  title: string,
  sourceQuery: string,
  n: number
): WebSearchResult => ({
  title,
  url: `https://example.com/${n}`,
  snippet: `${title} snippet`,
  content: `${title} body text about the subject. `.repeat(4),
  sourceQuery,
});

describe('sub-question labelling of sources', () => {
  // Searching the user's own words beside the plan means results now arrive
  // under two different sourceQuery values on every turn. Tagging them made
  // Gemma copy "[Answers: ...]" straight into its reply on device.
  it('does not tag sources when the second query is the question itself', () => {
    const out = webResultsToContext(
      [
        result(
          'Kraków attractions',
          'największe atrakcje turystyczne Krakowa',
          1
        ),
        result('Kraków guide', 'A jakie sa tam najwieksze atrakcje?', 2),
      ],
      'największe atrakcje turystyczne Krakowa + A jakie sa tam najwieksze atrakcje?',
      0,
      4000,
      { labelSubQueries: false }
    );
    expect(out.context.join(' ')).not.toContain('[Answers:');
  });

  it('still tags them when the plan really asked two things', () => {
    const out = webResultsToContext(
      [
        result('Bitcoin price', 'bitcoin price today', 1),
        result('Ethereum price', 'ethereum price today', 2),
      ],
      'bitcoin price today + ethereum price today',
      0,
      4000,
      { labelSubQueries: true }
    );
    expect(out.context.join(' ')).toContain('[Answers:');
  });

  it('records the question the user typed, not the joined retrieval query', () => {
    const out = webResultsToContext(
      [result('Kraków attractions', 'pogoda Kraków dzisiaj', 1)],
      'pogoda Kraków dzisiaj + jaka jest pogoda w Krakowie dzisiaj',
      0,
      4000,
      { displayQuery: 'jaka jest pogoda w Krakowie dzisiaj' }
    );
    expect(out.sourceDocuments[0]!.query).toBe(
      'jaka jest pogoda w Krakowie dzisiaj'
    );
  });

  it('falls back to the retrieval query when no display query is given', () => {
    const out = webResultsToContext(
      [result('Kraków attractions', 'pogoda Kraków', 1)],
      'pogoda Kraków',
      0,
      4000
    );
    expect(out.sourceDocuments[0]!.query).toBe('pogoda Kraków');
  });
});
