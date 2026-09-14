import { dedupeQueries, verbatimQueryFor } from '../utils/web/buildSearchQuery';

describe('dedupeQueries', () => {
  it('keeps every arm of a comparison', () => {
    expect(
      dedupeQueries(['bitcoin price today', 'ethereum price today'])
    ).toEqual(['bitcoin price today', 'ethereum price today']);
  });

  it('drops a repeat that differs only by case or diacritics', () => {
    expect(dedupeQueries(['pogoda Kraków', 'pogoda Krakow'])).toEqual([
      'pogoda Kraków',
    ]);
  });

  it('drops blanks', () => {
    expect(dedupeQueries(['  ', 'pogoda Kraków'])).toEqual(['pogoda Kraków']);
  });
});

describe('verbatimQueryFor', () => {
  it('offers the question when the plan phrased it differently', () => {
    expect(
      verbatimQueryFor('Jak daleko jest z Krakowa do Zakopanego?', [
        'distance between Krakow and Zakopane',
      ])
    ).toBe('Jak daleko jest z Krakowa do Zakopanego?');
  });

  it('offers nothing when the plan already is the question', () => {
    expect(
      verbatimQueryFor('pogoda Kraków dzisiaj', ['pogoda Kraków dzisiaj'])
    ).toBeNull();
  });

  it('strips a request opener before deciding it is a duplicate', () => {
    expect(
      verbatimQueryFor('Sprawdź pogoda Kraków', ['pogoda Kraków'])
    ).toBeNull();
  });
});
