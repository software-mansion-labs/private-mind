import {
  conversationSubject,
  namedEntitiesIn,
  sameEntity,
} from '../utils/web/conversationSubject';

const OLED_RECOMMENDATION =
  'Zgodnie z informacjami zawartymi w źródłach, najlepszym telewizorem OLED jest Samsung QE65S99H, ponieważ zachwyci Cię szeroką paletą barw. Matowy ekran z powłoką Glare Free sprawdzi się w nasłonecznionym salonie. Wyróżnione modele oferują sprawnie działające platformy Smart TV.';

describe('namedEntitiesIn', () => {
  it('reads a model number as an entity even when the brand is lowercase', () => {
    expect(
      namedEntitiesIn('Podaj parametry techniczne tv samsung QE65QN90D')
    ).toEqual(['QE65QN90D']);
  });

  it('keeps a model number inside a capitalised run as one entity', () => {
    expect(namedEntitiesIn('cena LG OLED65B65LA w Polsce')).toEqual([
      'LG OLED65B65LA',
    ]);
  });

  it('does not read a number with a unit, a bare year or a resolution as a model', () => {
    expect(
      namedEntitiesIn(
        'Częstotliwość 120Hz, rozdzielczość 4K, 6999 PLN, rok 2026'
      )
    ).toEqual([]);
  });

  it('does not read a two-letter abbreviation with a digit as a model', () => {
    expect(namedEntitiesIn('ekran 4K i procesor M4')).toEqual([]);
  });
});

describe('sameEntity', () => {
  it('matches an inflected mention with its base form', () => {
    expect(sameEntity('Donald Trump', 'Donalda Trumpa')).toBe(true);
    expect(sameEntity('Samsung Galaxy S25', 'Samsunga Galaxy S25')).toBe(true);
  });

  it('matches a bare model number with the branded mention', () => {
    expect(sameEntity('QE65S99H', 'Samsung QE65S99H')).toBe(true);
  });

  it('keeps two models of one brand apart', () => {
    expect(sameEntity('Samsung QE65S99H', 'Samsung QE65QN90D')).toBe(false);
    expect(sameEntity('LG G4', 'LG OLED65B65LA')).toBe(false);
  });

  it('reads a full SKU and its short model number as one model', () => {
    expect(sameEntity('Samsung QE65S99HATXXH', 'Samsung QE65S99H')).toBe(true);
    expect(sameEntity('Telewizor QE65QN90D', 'Samsung QE65QN90D')).toBe(true);
  });
});

describe('conversationSubject', () => {
  it('picks the model the answer settles on, not a capitalised feature name (live: "Smart TV" was the last run)', () => {
    expect(
      conversationSubject([
        {
          role: 'user',
          content:
            'Jeszcze raz wyszukaj tv do mojego salonu najlepszy tylko oled',
        },
        { role: 'assistant', content: OLED_RECOMMENDATION },
      ])
    ).toBe('Samsung QE65S99H');
  });

  it('does not let a list answer naming several models once displace the standing subject (#343)', () => {
    expect(
      conversationSubject([
        { role: 'user', content: 'Ile kosztuje?' },
        {
          role: 'assistant',
          content: 'Cena telewizora LG OLED65B65LA wynosi 6999.00 PLN.',
        },
        {
          role: 'user',
          content:
            'wypisz jakie ma funkcje i parametry techniczne oraz powiedz czy sprawdzi się w salonie z dużymi oknami',
        },
        {
          role: 'assistant',
          content:
            'Najlepszy telewizor dla dużego salonu w 2026 roku to Samsung QN90D 85" ($3,799), TCL QM8K 85" ($2,299) za swoją wartość, lub LG G4 83" OLED ($5,499).',
        },
      ])
    ).toBe('LG OLED65B65LA');
  });

  it('keeps both models the user asked to compare when the answer names them equally', () => {
    expect(
      conversationSubject([
        {
          role: 'user',
          content: 'porownaj Samsung QE65S99H i LG OLED65G45LA',
        },
        {
          role: 'assistant',
          content:
            '(1) Samsung QE65S99H ma matowy ekran.\n(2) LG OLED65G45LA jest jaśniejszy.',
        },
      ])
    ).toBe('Samsung QE65S99H LG OLED65G45LA');
  });

  it('follows the model the user typed with a lowercase brand through the answer', () => {
    const history = [
      {
        role: 'user',
        content: 'Podaj parametry techniczne tv samsung QE65QN90D',
      },
    ];
    expect(conversationSubject(history)).toBe('QE65QN90D');
    expect(
      conversationSubject([
        ...history,
        {
          role: 'assistant',
          content:
            'Samsung QE65QN90D ma matrycę 120Hz. Samsung QE65QN90D obsługuje HDMI 2.1.',
        },
      ])
    ).toBe('Samsung QE65QN90D');
  });

  it('does not count a capitalised sentence opener as part of the name', () => {
    expect(
      conversationSubject([
        { role: 'user', content: 'Ile kosztuje Samsung Galaxy S25 w Polsce' },
        {
          role: 'assistant',
          content: 'Cena Samsunga Galaxy S25 w Polsce wynosi 3999 zl.',
        },
      ])
    ).toBe('Samsung Galaxy S25');
  });

  it('drops a role noun the user wrote in lowercase from the front of a run', () => {
    expect(
      conversationSubject([
        { role: 'user', content: 'kto jest prezydentem usa?' },
        { role: 'assistant', content: 'Prezydentem USA jest Donald Trump.' },
      ])
    ).toBe('Donald Trump');
  });

  it('keeps a two-word name that opens the answer when nothing marks it as common', () => {
    expect(
      conversationSubject([
        { role: 'user', content: 'kto jest prezydentem usa?' },
        { role: 'assistant', content: 'Donald Trump.' },
      ])
    ).toBe('Donald Trump');
  });

  it('counts inflected mentions together', () => {
    expect(
      conversationSubject([
        { role: 'user', content: 'ile dzieci ma prezydent?' },
        {
          role: 'assistant',
          content:
            'Donald Trump ma pięcioro dzieci. Najstarszy syn Donalda Trumpa pracuje z Elon Musk w administracji.',
        },
      ])
    ).toBe('Donald Trump');
  });

  it('falls back to the most recent turn that names anything at all', () => {
    expect(
      conversationSubject([
        { role: 'user', content: 'Ile kosztuje Samsung Galaxy S25 w Polsce' },
        { role: 'assistant', content: 'Ten model kosztuje 3999 zl.' },
      ])
    ).toBe('Samsung Galaxy S25');
  });

  it('returns null when no turn names anything', () => {
    expect(
      conversationSubject([
        { role: 'user', content: 'hej, jak leci?' },
        { role: 'assistant', content: 'Wszystko dobrze, dzięki!' },
      ])
    ).toBeNull();
  });
});
