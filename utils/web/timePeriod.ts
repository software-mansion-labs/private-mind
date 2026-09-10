const YEAR_ANCHOR = /(?<![\p{L}\p{N}])(?:1[0-9]|20)\d{2}(?!\p{N})/u;
const ROMAN_NUMERAL_TOKEN = /(?<![\p{L}\p{N}])[IVXLCDM]{2,}(?![\p{L}\p{N}])/gu;
const WELL_FORMED_ROMAN =
  /^M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})$/;

export const namesATimePeriod = (question: string): boolean =>
  YEAR_ANCHOR.test(question) ||
  (question.match(ROMAN_NUMERAL_TOKEN) ?? []).some((token) =>
    WELL_FORMED_ROMAN.test(token)
  );
