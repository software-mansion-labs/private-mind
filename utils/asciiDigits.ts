const ANY_DIGIT_CHAR = /\p{Nd}/gu;
const IS_DIGIT_CHAR = /\p{Nd}/u;
const DIGITS_PER_SYSTEM = 10;

const isDigitAt = (code: number): boolean =>
  code >= 0 && IS_DIGIT_CHAR.test(String.fromCodePoint(code));

const digitValue = (code: number): number | null => {
  let zero = code;
  while (code - zero < DIGITS_PER_SYSTEM && isDigitAt(zero - 1)) zero -= 1;
  return isDigitAt(zero - 1) ? null : code - zero;
};

export const toAsciiDigits = (text: string): string =>
  text.replace(ANY_DIGIT_CHAR, (char) => {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 0x30 && code <= 0x39) return char;
    const value = digitValue(code);
    return value === null ? char : String(value);
  });
