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
  it('highlights the line that answers, not the section heading that names the topic', () => {
    const passage =
      '1. OPENING HOURS\n- Monday to Friday: 5:30 AM to 11:00 PM\n- Sunday: 8:00 AM to 6:00 PM (staffed desk closes at 4:00 PM)\n2. MEMBERSHIP PRICES';
    const span = findCitedSpan(
      passage,
      'What are the opening hours on Sunday?'
    );
    expect(passage.slice(span!.start, span!.end)).toContain('Sunday: 8:00 AM');
  });

  it('highlights the line holding the answer when the question words match another line as well (A-100)', () => {
    const passage =
      '1. OPENING HOURS\n- Sunday: 8:00 AM to 6:00 PM (staffed desk closes at 4:00 PM)\n3. LOCKER ROOM RULES\n- Cut padlocks are removed after 48 hours.';
    const span = findCitedSpan(
      passage,
      'What are the opening hours on Sunday?',
      'The opening hours on Sunday are 8:00 AM to 6:00 PM.'
    );
    expect(passage.slice(span!.start, span!.end)).toContain('Sunday: 8:00 AM');
  });

  it('highlights the price the answer gave, not a line that shares the question words', () => {
    const passage =
      '- Day pass: 12 USD\n- Monthly pass: 49 USD (auto-renews)\n- Rental lockers cost 8 USD per month.';
    const span = findCitedSpan(
      passage,
      'How much does a rental locker cost per month?',
      'A rental locker costs 8 USD per month.'
    );
    expect(passage.slice(span!.start, span!.end)).toContain('Rental lockers');
  });

  it('still highlights a heading when nothing else in the passage matches', () => {
    const passage = 'OPENING HOURS\nAsk at the front desk.';
    const span = findCitedSpan(passage, 'opening hours');
    expect(passage.slice(span!.start, span!.end)).toBe('OPENING HOURS');
  });

  it('can highlight a list line that has no full stop', () => {
    const passage =
      'PRICES\n- Day pass: 12 USD\n- Monthly pass: 49 USD\nAll prices include tax.';
    const span = findCitedSpan(passage, 'How much is the monthly pass?');
    expect(passage.slice(span!.start, span!.end)).toBe(
      '- Monthly pass: 49 USD'
    );
  });

  it('returns the span of the sentence most relevant to the query', () => {
    const passage =
      'The company was founded in 1998. Total revenue reached 2455 PLN last year. Employees enjoy free coffee.';
    const span = findCitedSpan(passage, 'What was the total revenue?');

    expect(span).not.toBeNull();
    const cited = passage.slice(span!.start, span!.end);
    expect(cited).toBe('Total revenue reached 2455 PLN last year.');
  });

  it('keeps a decimal amount inside the cited sentence', () => {
    const passage =
      'The tenant may leave early. Where such notice is given, the Tenant shall pay an early termination fee equal to one month rent, being 1,450.00 EUR. Pets are not allowed.';
    const span = findCitedSpan(passage, 'What termination fee must I pay?');

    expect(span).not.toBeNull();
    expect(passage.slice(span!.start, span!.end)).toBe(
      'Where such notice is given, the Tenant shall pay an early termination fee equal to one month rent, being 1,450.00 EUR.'
    );
  });

  it('does not split a sentence on a clause number', () => {
    const passage =
      'Rent is due monthly. Early termination under Clause 7.2 does not forfeit the deposit. Utilities are billed separately.';
    const span = findCitedSpan(passage, 'Does early termination forfeit it?');

    expect(span).not.toBeNull();
    expect(passage.slice(span!.start, span!.end)).toBe(
      'Early termination under Clause 7.2 does not forfeit the deposit.'
    );
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
