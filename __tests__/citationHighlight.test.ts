import { findCitedSpan, queryNamesDocument } from '../utils/citationHighlight';

describe('queryNamesDocument', () => {
  it('matches when every filename token appears in the query', () => {
    expect(
      queryNamesDocument(
        'Co jest w pliku polityka_urlopowa_2026.txt',
        'polityka_urlopowa_2026.txt'
      )
    ).toBe(true);
  });

  it('does not match an unrelated document sharing only an incidental term', () => {
    expect(
      queryNamesDocument(
        'Co jest w pliku polityka_urlopowa_2026.txt',
        'sample.pdf'
      )
    ).toBe(false);
  });

  it('returns false when the query names no document', () => {
    expect(
      queryNamesDocument('O czym jest ten plik?', 'raport_finansowy.pdf')
    ).toBe(false);
  });
});

describe('findCitedSpan', () => {
  it('returns the span of the sentence most relevant to the query', () => {
    const passage =
      'The company was founded in 1998. Total revenue reached 2455 PLN last year. Employees enjoy free coffee.';
    const span = findCitedSpan(passage, 'What was the total revenue?');

    expect(span).not.toBeNull();
    const cited = passage.slice(span!.start, span!.end);
    expect(cited).toBe('Total revenue reached 2455 PLN last year.');
  });

  it('matches identifiers/numbers even when short', () => {
    const passage =
      'Ogólne warunki umowy. Faktura FS-219039 na kwotę 2455,01 PLN. Dziękujemy za współpracę.';
    const span = findCitedSpan(passage, 'Ile wynosi faktura FS-219039?');

    expect(span).not.toBeNull();
    const cited = passage.slice(span!.start, span!.end);
    expect(cited).toContain('FS-219039');
  });

  it('picks the narrowest (densest) sentence when scores tie', () => {
    const passage =
      'Revenue. This long sentence also mentions revenue but pads it with a great many additional unrelated words.';
    const span = findCitedSpan(passage, 'revenue');

    expect(span).not.toBeNull();
    expect(passage.slice(span!.start, span!.end)).toBe('Revenue.');
  });

  it('matches an inflected passage word to its query stem (Polish)', () => {
    const passage =
      'Czy moje dane sa bezpieczne? Wszystkie modele dzialaja lokalnie, a dane nigdy nie opuszczaja urzadzenia.';
    const span = findCitedSpan(passage, 'Czy moje dane opuszczaja urzadzenie?');

    expect(span).not.toBeNull();
    const cited = passage.slice(span!.start, span!.end);
    expect(cited).toBe(
      'Wszystkie modele dzialaja lokalnie, a dane nigdy nie opuszczaja urzadzenia.'
    );
  });

  it('does not stem-match short tokens or identifiers', () => {
    const span = findCitedSpan('Zupa dania obiadowe.', 'gdzie sa dane');
    expect(span).toBeNull();
  });

  it('returns null when nothing overlaps', () => {
    expect(
      findCitedSpan('Completely unrelated content here.', 'quarterly revenue')
    ).toBeNull();
  });

  it('ignores stopword-only queries', () => {
    expect(findCitedSpan('Some real content.', 'what is the')).toBeNull();
  });

  it('handles empty/undefined input safely', () => {
    expect(findCitedSpan(undefined, 'revenue')).toBeNull();
    expect(findCitedSpan('', 'revenue')).toBeNull();
    expect(findCitedSpan('Content.', '')).toBeNull();
  });

  it('produces offsets that map back onto the original passage', () => {
    const passage = 'Intro line.\nThe invoice number is 12345.\nOutro.';
    const span = findCitedSpan(passage, 'invoice 12345');

    expect(span).not.toBeNull();
    expect(passage.slice(span!.start, span!.end)).toBe(
      'The invoice number is 12345.'
    );
  });

  it('does not highlight on a single weak (stem-only) match', () => {
    const span = findCitedSpan(
      'Skanowanie kodu QR ulatwia pobranie dokumentu z systemu KSeF.',
      'Co jest kupowane w dokumencie'
    );
    expect(span).toBeNull();
  });

  it('still highlights when two terms match by stem', () => {
    const span = findCitedSpan(
      'Instrukcja obslugi urzadzenia oraz dokumentacji technicznej.',
      'urzadzenie i dokumentacja'
    );
    expect(span).not.toBeNull();
  });
});
