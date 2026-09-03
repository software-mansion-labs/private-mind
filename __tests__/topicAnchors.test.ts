import { topicAnchorer, topicAnchors } from '../utils/web/topicAnchors';

const oledChat = [
  { role: 'user', content: 'jaki jest najlepszy tv OLED?' },
  {
    role: 'assistant',
    content:
      'Model LG OLED65B65LA znalazł się w zestawieniu najlepszych telewizorów OLED 2026.',
  },
  { role: 'user', content: 'Podaj parametry techniczne tv samsung QE65QN90D' },
  {
    role: 'assistant',
    content:
      'Samsung QE65QN90D to telewizor Neo QLED z matrycą 120 Hz i jasnością 2000 nitów.',
  },
  {
    role: 'user',
    content: 'Jeszcze raz wyszukaj tv do mojego salonu najlepszy tylko oled',
  },
  {
    role: 'assistant',
    content:
      'Najlepszym telewizorem OLED do jasnego salonu jest Samsung QE65S99H. Cena wynosi 12 999 zł.',
  },
  { role: 'user', content: 'Jaka jest jego cena?' },
  { role: 'assistant', content: 'Cena Samsung QE65S99H wynosi 12 999 zł.' },
];

const CHEAPER = 'Trochę za drogi znajdź tańszy spełniający moje wymagania';

describe('topicAnchors', () => {
  it('finds the acronym the user came back to, however they capitalised it', () => {
    expect(topicAnchors(oledChat)).toEqual(['OLED']);
  });

  it('does not take an acronym the user typed once', () => {
    expect(
      topicAnchors([
        { role: 'user', content: 'jaki jest najlepszy tv OLED?' },
        { role: 'assistant', content: 'LG OLED65B65LA prowadzi w rankingach.' },
        { role: 'user', content: 'ile kosztuje?' },
      ])
    ).toEqual([]);
  });

  it('counts the digest as one mention the user did not have to repeat', () => {
    expect(
      topicAnchors(
        [
          { role: 'user', content: 'jaki jest najlepszy tv OLED?' },
          {
            role: 'assistant',
            content: 'LG OLED65B65LA prowadzi w rankingach.',
          },
          { role: 'user', content: 'ile kosztuje?' },
        ],
        'najlepszy telewizor OLED, LG OLED65B65LA'
      )
    ).toEqual(['OLED']);
  });

  it('ignores a repeated word nobody wrote as an acronym', () => {
    expect(
      topicAnchors([
        { role: 'user', content: 'jaki telewizor do salonu?' },
        { role: 'assistant', content: 'Do salonu polecam LG OLED65B65LA.' },
        { role: 'user', content: 'a tańszy do salonu?' },
      ])
    ).toEqual([]);
  });

  it('does not lift a brand out of the model names the user typed', () => {
    expect(
      topicAnchors([
        { role: 'user', content: 'ile kosztuje LG OLED65B65LA?' },
        { role: 'assistant', content: 'LG OLED65B65LA kosztuje 6999 zł.' },
        { role: 'user', content: 'a LG OLED65C55LA?' },
      ])
    ).toEqual([]);
  });
});

describe('topicAnchorer', () => {
  const anchor = topicAnchorer(CHEAPER, oledChat);

  it('puts the anchor back into a planner query that dropped it (live #353)', () => {
    expect(anchor('tańszy telewizor podobny')).toBe(
      'tańszy telewizor podobny OLED'
    );
  });

  it('leaves a query alone when it already carries the anchor, even inside a model name', () => {
    expect(anchor('tańszy telewizor OLED')).toBe('tańszy telewizor OLED');
    expect(anchor('cena LG OLED65B65LA')).toBe('cena LG OLED65B65LA');
  });

  it('leaves a query alone when it shares no word with the anchored turns', () => {
    expect(anchor('bilety do kina repertuar')).toBe('bilety do kina repertuar');
  });

  it('does not anchor when the latest message stands on its own', () => {
    const withOwnAcronym = topicAnchorer(
      'jaki telewizor QLED polecacie?',
      oledChat
    );
    expect(withOwnAcronym('najlepszy telewizor QLED')).toBe(
      'najlepszy telewizor QLED'
    );
    const withOwnName = topicAnchorer(
      'ile kosztuje Sony Bravia do salonu?',
      oledChat
    );
    expect(withOwnName('cena Sony Bravia telewizor')).toBe(
      'cena Sony Bravia telewizor'
    );
    const withOwnNumber = topicAnchorer(
      'jaki telewizor 55 cali do salonu?',
      oledChat
    );
    expect(withOwnNumber('telewizor 55 cali salon')).toBe(
      'telewizor 55 cali salon'
    );
  });

  it('does nothing when the conversation has no anchor', () => {
    expect(topicAnchorer(CHEAPER, [])('tańszy telewizor podobny')).toBe(
      'tańszy telewizor podobny'
    );
  });
});
