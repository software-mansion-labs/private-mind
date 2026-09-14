import { truncateAtRepeatedClause } from '../utils/loopDetection';

describe('truncation never destroys the whole answer', () => {
  const SENTENCE =
    'Nie jest możliwe podanie ostatecznej ceny abonamentu, ponieważ źródła prezentują różne opcje.';

  it('keeps one copy when the model says the same sentence twice', () => {
    const out = truncateAtRepeatedClause(`${SENTENCE}\n\n${SENTENCE}`);
    expect(out.trim().length).toBeGreaterThan(0);
    expect(out).toContain('Nie jest możliwe podanie ostatecznej ceny');
    expect(out.split('ostatecznej ceny').length - 1).toBe(1);
  });

  it('keeps the content that follows a repeated word run', () => {
    const out = truncateAtRepeatedClause('Cena Cena Cena Cena wynosi 100 zł.');
    expect(out.trim().length).toBeGreaterThan(0);
  });

  it('still cuts a tail that repeats after real content', () => {
    const out = truncateAtRepeatedClause(
      `Bilet kosztuje 45 zł.\n${SENTENCE}\n${SENTENCE}`
    );
    expect(out).toContain('45 zł');
    expect(out.split('ostatecznej ceny').length - 1).toBeLessThanOrEqual(1);
  });

  it('leaves text without repetition untouched', () => {
    const clean = 'Bilet normalny kosztuje 45 zł, a ulgowy 30 zł.';
    expect(truncateAtRepeatedClause(clean)).toBe(clean);
  });

  it('returns empty only for input that was empty', () => {
    expect(truncateAtRepeatedClause('')).toBe('');
    expect(truncateAtRepeatedClause('   ').trim()).toBe('');
  });
});
