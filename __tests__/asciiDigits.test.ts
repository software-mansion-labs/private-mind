import { toAsciiDigits } from '../utils/asciiDigits';

const zerosInUnicode = (): number[] => {
  const zeros: number[] = [];
  for (let code = 0; code <= 0x2ffff; code += 1) {
    const char = String.fromCodePoint(code);
    if (!/\p{Nd}/u.test(char)) continue;
    if (/\p{Nd}/u.test(String.fromCodePoint(code - 1))) continue;
    zeros.push(code);
  }
  return zeros;
};

describe('toAsciiDigits', () => {
  it('leaves ascii digits and surrounding text alone', () => {
    expect(toAsciiDigits('cena 1 299,50 PLN')).toBe('cena 1 299,50 PLN');
  });

  it('reads the scripts our users actually write in', () => {
    expect(toAsciiDigits('٣٥٠ ريال')).toBe('350 ريال');
    expect(toAsciiDigits('۱۲۳۴')).toBe('1234');
    expect(toAsciiDigits('१२,५००')).toBe('12,500');
    expect(toAsciiDigits('１２３')).toBe('123');
  });

  it('reads scripts the old base table never carried', () => {
    expect(toAsciiDigits('੧੨੩')).toBe('123');
    expect(toAsciiDigits('૧૨૩')).toBe('123');
    expect(toAsciiDigits('௧௨௩')).toBe('123');
    expect(toAsciiDigits('౧౨౩')).toBe('123');
    expect(toAsciiDigits('๑๒๓')).toBe('123');
    expect(toAsciiDigits('១២៣')).toBe('123');
    expect(toAsciiDigits('၁၂၃')).toBe('123');
  });

  it('reads every decimal digit system in unicode, not a hand-kept list', () => {
    const unread = zerosInUnicode().filter((zero) => {
      const written = [0, 1, 9]
        .map((offset) => String.fromCodePoint(zero + offset))
        .join('');
      return toAsciiDigits(written) !== '019';
    });

    expect(unread.map((code) => code.toString(16))).toEqual([]);
  });
});
