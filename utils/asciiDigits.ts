const DIGIT_BASES = [0x0660, 0x06f0, 0x0966, 0x09e6, 0xff10];
const ANY_DIGIT_CHAR = /\p{Nd}/gu;

export const toAsciiDigits = (text: string): string =>
  text.replace(ANY_DIGIT_CHAR, (char) => {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 0x30 && code <= 0x39) return char;
    for (const base of DIGIT_BASES) {
      if (code >= base && code <= base + 9) return String(code - base);
    }
    return char;
  });
