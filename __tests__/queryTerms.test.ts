import { extractQueryTerms, stemPrefix } from '../utils/queryTerms';

describe('extractQueryTerms', () => {
  it('drops short bare numbers and codes that caused false highlights', () => {
    const terms = extractQueryTerms('L4 100% for the first 5 of 30 days');
    expect(terms.has('l4')).toBe(false);
    expect(terms.has('5')).toBe(false);
    expect(terms.has('30')).toBe(false);
    expect(terms.has('100')).toBe(true);
    expect(terms.has('first')).toBe(true);
    expect(terms.has('days')).toBe(true);
  });

  it('keeps longer identifiers and years', () => {
    const terms = extractQueryTerms('What changed in invoice FS-219039 during 2020?');
    expect(terms.has('219039')).toBe(true);
    expect(terms.has('2020')).toBe(true);
    expect(terms.has('invoice')).toBe(true);
    expect(terms.has('fs')).toBe(false);
  });

  it('ignores stopwords and empty input', () => {
    expect(extractQueryTerms('what is the').size).toBe(0);
    expect(extractQueryTerms('').size).toBe(0);
  });
});

describe('stemPrefix', () => {
  it('reduces inflected Polish words to a shared stem', () => {
    expect(stemPrefix('pliku')).toBe('plik');
    expect(stemPrefix('plików')).toBe('plik');
    expect(stemPrefix('linijce')).toBe('linij');
  });

  it('never truncates below 4 characters', () => {
    expect(stemPrefix('kotek')).toBe('kote');
    expect(stemPrefix('rok')).toBe('rok');
  });

  it('leaves identifiers, codes and years untouched', () => {
    expect(stemPrefix('219039')).toBe('219039');
    expect(stemPrefix('e-4021')).toBe('e-4021');
    expect(stemPrefix('2026')).toBe('2026');
  });
});
