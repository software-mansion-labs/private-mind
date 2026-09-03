import { withVerbatimFallback } from '../utils/web/buildSearchQuery';

describe('withVerbatimFallback', () => {
  // The planner is one model call, and on device it mistranslated, swapped an
  // entity and carried a name in from an earlier turn. Whatever it returns, the
  // user's own words stay in the search.
  it('searches the question alongside a plan that translated it away', () => {
    expect(
      withVerbatimFallback(
        ['distance between Krakow and Zakopane'],
        'Jak daleko jest z Krakowa do Zakopanego?'
      )
    ).toEqual([
      'distance between Krakow and Zakopane',
      'Jak daleko jest z Krakowa do Zakopanego?',
    ]);
  });

  it('keeps the question when the plan swapped the entity', () => {
    const queries = withVerbatimFallback(
      ['euro to dollar exchange rate today'],
      'kurs euro dzisiaj'
    );
    expect(queries).toContain('kurs euro dzisiaj');
  });

  it('does not repeat a plan that already matches the question', () => {
    expect(
      withVerbatimFallback(['pogoda Kraków dzisiaj'], 'pogoda Kraków dzisiaj')
    ).toEqual(['pogoda Kraków dzisiaj']);
  });

  it('strips a request opener before comparing, so it is not a near-duplicate', () => {
    expect(
      withVerbatimFallback(['pogoda Kraków'], 'Sprawdź pogoda Kraków')
    ).toEqual(['pogoda Kraków']);
  });

  it('keeps every comparison arm and still adds the question', () => {
    expect(
      withVerbatimFallback(
        ['bitcoin price today', 'ethereum price today'],
        'compare the prices of bitcoin and ethereum'
      )
    ).toEqual([
      'bitcoin price today',
      'ethereum price today',
      'compare the prices of bitcoin and ethereum',
    ]);
  });

  it('caps how many searches one turn can trigger', () => {
    const queries = withVerbatimFallback(
      ['a rocket', 'b rocket', 'c rocket', 'd rocket', 'e rocket'],
      'jakie rakiety'
    );
    expect(queries).toHaveLength(4);
  });

  it('falls back to the question alone when the plan is empty', () => {
    expect(withVerbatimFallback([], 'kurs euro do złotego')).toEqual([
      'kurs euro do złotego',
    ]);
  });

  it('drops blank plan entries', () => {
    expect(withVerbatimFallback(['  ', ''], 'pogoda Zakopane')).toEqual([
      'pogoda Zakopane',
    ]);
  });
});
