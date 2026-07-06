import {
  buildKeywordMatchExpression,
  foldForKeywordIndex,
} from '../database/keywordIndex';

describe('foldForKeywordIndex', () => {
  it('folds the Polish stroke letter ł/Ł to l/L (leaving other letters intact)', () => {
    expect(foldForKeywordIndex('płatność')).toBe('platność');
    expect(foldForKeywordIndex('usługę')).toBe('uslugę');
    expect(foldForKeywordIndex('Łódź')).toBe('Lódź');
  });

  it('leaves decomposable diacritics for the FTS tokenizer to fold', () => {
    expect(foldForKeywordIndex('księgową')).toBe('księgową');
  });

  it('leaves plain ASCII untouched', () => {
    expect(foldForKeywordIndex('invoice E4021')).toBe('invoice E4021');
  });
});

describe('buildKeywordMatchExpression', () => {
  it('prefix-matches the stem of an inflected word so "pliku" finds "plików"', () => {
    expect(buildKeywordMatchExpression(['pliku'])).toBe('"plik"*');
    expect(buildKeywordMatchExpression(['plików'])).toBe('"plik"*');
  });

  it('folds ł in terms and prefix-matches the stem', () => {
    expect(buildKeywordMatchExpression(['płatność'])).toBe('"platno"*');
  });

  it('OR-joins the stemmed terms', () => {
    expect(buildKeywordMatchExpression(['invoice', 'total'])).toBe(
      '"invoi"* OR "tota"*'
    );
  });

  it('matches identifiers exactly (no stemming, no prefix)', () => {
    expect(buildKeywordMatchExpression(['219039'])).toBe('"219039"');
    expect(buildKeywordMatchExpression(['e-4021'])).toBe('"e-4021"');
  });

  it('quotes terms so FTS5 operators are treated as literals', () => {
    expect(buildKeywordMatchExpression(['e-4021', 'OR'])).toBe(
      '"e-4021" OR "OR"'
    );
  });

  it('escapes embedded double quotes by doubling them', () => {
    expect(buildKeywordMatchExpression(['22"'])).toBe('"22"""');
  });

  it('drops blank terms', () => {
    expect(buildKeywordMatchExpression(['  ', 'ok'])).toBe('"ok"');
  });

  it('returns null when there is nothing to search', () => {
    expect(buildKeywordMatchExpression([])).toBeNull();
    expect(buildKeywordMatchExpression(['   '])).toBeNull();
  });
});
