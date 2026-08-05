import {
  extractQueryTerms,
  foldForMatching,
  stemPrefix,
} from '../utils/queryTerms';

describe('foldForMatching', () => {
  it('folds Polish diacritics and the stroke letter to plain ASCII', () => {
    expect(foldForMatching('płatność')).toBe('platnosc');
    expect(foldForMatching('Księgową')).toBe('ksiegowa');
    expect(foldForMatching('ŁÓDŹ')).toBe('lodz');
  });

  it('lands a diacriticised query and a plain one on the same string', () => {
    expect(foldForMatching('płatność')).toBe(foldForMatching('platnosc'));
  });

  it('leaves plain ASCII untouched apart from case', () => {
    expect(foldForMatching('invoice E4021')).toBe('invoice e4021');
  });
});

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
    const terms = extractQueryTerms(
      'What changed in invoice FS-219039 during 2020?'
    );
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

describe('non-Latin scripts', () => {
  it('keeps accented Latin words whole instead of splitting at the accent', () => {
    expect(extractQueryTerms('café Straße')).toEqual(
      new Set(['café', 'straße'])
    );
  });

  it('folds Western European accents and ligatures for matching', () => {
    expect(foldForMatching('café')).toBe('cafe');
    expect(foldForMatching('Straße')).toBe('strasse');
    expect(foldForMatching('Æon Øre')).toBe('aeon ore');
  });

  it('extracts terms from Cyrillic and Greek queries', () => {
    expect(extractQueryTerms('погода Москва')).toEqual(
      new Set(['погода', 'москва'])
    );
    expect(extractQueryTerms('καιρός Αθήνα')).toEqual(
      new Set(['καιρός', 'αθήνα'])
    );
  });

  it('extracts terms from Arabic queries', () => {
    expect(extractQueryTerms('الطقس اليوم').size).toBe(2);
  });

  it('indexes CJK and kana as character bigrams', () => {
    const terms = extractQueryTerms('東京の天気');
    expect(terms.size).toBeGreaterThan(0);
    expect(terms.has('天気')).toBe(true);
    expect(extractQueryTerms('てんき').has('てん')).toBe(true);
  });

  it('never stems a CJK bigram', () => {
    expect(stemPrefix('天気')).toBe('天気');
    expect(stemPrefix('東京都新宿区')).toBe('東京都新宿区');
  });

  it('still stems accented Latin words', () => {
    expect(stemPrefix('Straßen')).toBe('Straß');
  });
});

describe('short words in scripts that write them in two characters', () => {
  it('keeps two-character Devanagari and Arabic-script words', () => {
    expect(extractQueryTerms('जल कहाँ है')).toContain('जल');
    expect(extractQueryTerms('گل کی قیمت')).toContain('گل');
  });

  it('still drops two-character Latin noise', () => {
    expect(extractQueryTerms('l4 to xy')).not.toContain('xy');
  });
});

describe('letters whose lowercase form carries a combining mark', () => {
  it('keeps Turkish dotted I in one token so folding can match it', () => {
    const terms = [...extractQueryTerms('bugün İstanbulda hava nasıl')];
    expect(terms.map(foldForMatching)).toContain('istanbulda');
  });
});

describe('a Latin name glued to an unsegmented script', () => {
  it('keeps the Latin run whole and bigrams only the rest', () => {
    const terms = extractQueryTerms('iPhone15の新機能について');
    expect(terms).toContain('iphone15');
    expect(terms).toContain('の新');
  });

  it('does not emit a lone ideograph left over from the split', () => {
    expect(extractQueryTerms('2026年8月5日の天気')).not.toContain('年');
  });
});
