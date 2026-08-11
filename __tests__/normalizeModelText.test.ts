import {
  detectDominantScript,
  normalizeModelText,
} from '../utils/normalizeModelText';

describe('detectDominantScript', () => {
  it('classifies by the script the answer is mostly written in', () => {
    expect(detectDominantScript('Temperatura 21 stopni')).toBe('latin');
    expect(detectDominantScript('東京の天気は晴れです')).toBe('cjk');
    expect(detectDominantScript('الطقس اليوم مشمس')).toBe('arabic');
    expect(detectDominantScript('Погода сегодня солнечная')).toBe('cyrillic');
    expect(detectDominantScript('')).toBe('other');
  });
});

describe('normalizeModelText — Polish answers', () => {
  it('folds fullwidth digits to ASCII', () => {
    expect(normalizeModelText('Temperatura – ２１ °C')).toBe(
      'Temperatura – 21 °C'
    );
    expect(normalizeModelText('Cisnienie １０２１ hPa')).toBe(
      'Cisnienie 1021 hPa'
    );
  });

  it('folds compatibility unit codepoints without a lookup table', () => {
    expect(normalizeModelText('Wiatr 8 ㎞/h, opad 3 ㎜, masa 5 ㎏')).toBe(
      'Wiatr 8 km/h, opad 3 mm, masa 5 kg'
    );
    expect(normalizeModelText('Predkosc 12 ㎧ przy ℃ dodatnim')).toBe(
      'Predkosc 12 m/s przy °C dodatnim'
    );
  });

  it('keeps superscripts, which NFKC would flatten into a wrong meaning', () => {
    expect(normalizeModelText('Powierzchnia 30 m²')).toBe('Powierzchnia 30 m²');
  });

  it('repairs a Cyrillic homoglyph inside a Latin word', () => {
    expect(normalizeModelText('tеmpеratura')).toBe('temperatura');
    expect(normalizeModelText('Gdańsк')).toBe('Gdańsk');
  });

  it('maps a unit written in the wrong script to its canonical form', () => {
    expect(normalizeModelText('Wiatr \u2013 17 \u043a\u043c/\u0447')).toBe(
      'Wiatr \u2013 17 km/h'
    );
    expect(normalizeModelText('Odleglosc 5 \u043a\u043c')).toBe(
      'Odleglosc 5 km'
    );
  });

  it('repairs a Cyrillic letter in a symbol token', () => {
    expect(normalizeModelText('Temperatura 21 \u00b0\u0421')).toBe(
      'Temperatura 21 \u00b0C'
    );
  });

  it('does not latinise a genuine foreign word quoted in a Latin answer', () => {
    expect(normalizeModelText('Rosyjskie \u043a\u0430\u043a znaczy jak')).toBe(
      'Rosyjskie \u043a\u0430\u043a znaczy jak'
    );
  });

  it('leaves correct Polish text untouched', () => {
    const text =
      'Temperatura wynosi 21 °C, wilgotność 46%, ciśnienie 1016 hPa.';
    expect(normalizeModelText(text)).toBe(text);
  });

  it('unwraps LaTeX-wrapped degrees into plain text', () => {
    expect(
      normalizeModelText('Temperatura o godzinie 02:00: $23^\\circ\\text{C}$')
    ).toBe('Temperatura o godzinie 02:00: 23°C');
    expect(normalizeModelText('Jutro $-1.5^{\\circ}\\mathrm{C}$ rano')).toBe(
      'Jutro -1.5°C rano'
    );
    expect(normalizeModelText('About $72°F$ at noon')).toBe(
      'About 72°F at noon'
    );
    expect(normalizeModelText('Zachmurzenie $80^\\circ$')).toBe(
      'Zachmurzenie 80°'
    );
  });

  it('leaves genuine inline math alone', () => {
    const text = 'Wzór to $E = mc^2$, a nie $x_i$.';
    expect(normalizeModelText(text)).toBe(text);
  });
});

describe('normalizeModelText — other scripts', () => {
  it('keeps fullwidth digits in Japanese, where they are correct typography', () => {
    const text = '東京の気温は２１度です。';
    expect(normalizeModelText(text)).toBe(text);
  });

  it('keeps Arabic-Indic digits in Arabic answers', () => {
    const text = 'درجة الحرارة ٢١ درجة مئوية';
    expect(normalizeModelText(text)).toBe(text);
  });

  it('still folds fullwidth forms in an Arabic answer', () => {
    expect(normalizeModelText('درجة الحرارة ２１')).toBe('درجة الحرارة 21');
  });

  it('does not latinise a genuine Russian answer', () => {
    const text = 'Погода сегодня солнечная, температура 21 градус';
    expect(normalizeModelText(text)).toBe(text);
  });

  it('passes empty input through', () => {
    expect(normalizeModelText('')).toBe('');
  });
});
