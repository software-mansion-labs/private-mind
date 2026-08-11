type Script = 'latin' | 'cjk' | 'arabic' | 'cyrillic' | 'other';

const CJK = /[぀-ヿ㐀-䶿一-鿿가-힯]/;
const ARABIC = /[؀-ۿݐ-ݿ]/;
const CYRILLIC = /[Ѐ-ӿ]/;
const LATIN = /[a-zÀ-ɏ]/i;

const FULLWIDTH_START = 0xff01;
const FULLWIDTH_END = 0xff5e;
const FULLWIDTH_TO_ASCII_OFFSET = 0xfee0;

const COMPATIBILITY_FORMS = /[！-～㌀-㏿℀-⅏⅐-↏]/g;

const canNormalize = (() => {
  try {
    return 'Ａ'.normalize('NFKC') === 'A';
  } catch {
    return false;
  }
})();

const HOMOGLYPHS: Record<string, string> = {
  а: 'a',
  в: 'b',
  е: 'e',
  к: 'k',
  м: 'm',
  н: 'h',
  о: 'o',
  р: 'p',
  с: 'c',
  т: 't',
  у: 'y',
  х: 'x',
  і: 'i',
  ј: 'j',
  ѕ: 's',
  А: 'A',
  В: 'B',
  Е: 'E',
  К: 'K',
  М: 'M',
  Н: 'H',
  О: 'O',
  Р: 'P',
  С: 'C',
  Т: 'T',
  У: 'Y',
  Х: 'X',
  І: 'I',
  Ј: 'J',
  Ѕ: 'S',
  α: 'a',
  β: 'B',
  ε: 'e',
  ι: 'i',
  κ: 'k',
  ν: 'v',
  ο: 'o',
  ρ: 'p',
  τ: 't',
  υ: 'u',
  χ: 'x',
  Α: 'A',
  Β: 'B',
  Ε: 'E',
  Ζ: 'Z',
  Η: 'H',
  Ι: 'I',
  Κ: 'K',
  Μ: 'M',
  Ν: 'N',
  Ο: 'O',
  Ρ: 'P',
  Τ: 'T',
  Υ: 'Y',
  Χ: 'X',
};

export const detectDominantScript = (text: string): Script => {
  let cjk = 0;
  let arabic = 0;
  let cyrillic = 0;
  let latin = 0;
  for (const char of text) {
    if (CJK.test(char)) cjk += 1;
    else if (ARABIC.test(char)) arabic += 1;
    else if (CYRILLIC.test(char)) cyrillic += 1;
    else if (LATIN.test(char)) latin += 1;
  }
  const max = Math.max(cjk, arabic, cyrillic, latin);
  if (max === 0) return 'other';
  if (max === cjk) return 'cjk';
  if (max === arabic) return 'arabic';
  if (max === cyrillic) return 'cyrillic';
  return 'latin';
};

const foldFullwidth = (text: string): string =>
  text.replace(/[！-～]/g, (char) => {
    const code = char.charCodeAt(0);
    return code >= FULLWIDTH_START && code <= FULLWIDTH_END
      ? String.fromCharCode(code - FULLWIDTH_TO_ASCII_OFFSET)
      : char;
  });

const DIVISION_SLASH = /∕/g;

const foldCompatibilityForms = (text: string): string =>
  canNormalize
    ? text
        .replace(COMPATIBILITY_FORMS, (char) => char.normalize('NFKC'))
        .replace(DIVISION_SLASH, '/')
    : foldFullwidth(text);

const WORD = /[^\s.,;:!?()[\]{}"'«»„”—–-]+/g;

const LETTER = /\p{L}/u;

const UNIT_FORMS: Record<string, string> = {
  'км/ч': 'km/h',
  'км/год': 'km/h',
  'м/с': 'm/s',
  'км': 'km',
  'кг': 'kg',
  'мм': 'mm',
  'см': 'cm',
  'мл': 'ml',
};

const foldUnits = (text: string): string =>
  text.replace(WORD, (word) => UNIT_FORMS[word] ?? word);

const LATEX_DEGREES =
  /\$(-?\d+(?:[.,]\d+)?)\s*(?:\^\s*(?:\{\s*)?\\circ(?:\s*\})?|°)\s*(?:\\text\s*\{\s*([CF])\s*\}|\\mathrm\s*\{\s*([CF])\s*\}|([CF]))?\s*\$/g;

const foldLatexDegrees = (text: string): string =>
  text.replace(
    LATEX_DEGREES,
    (_, value, a, b, c) => `${value}°${a ?? b ?? c ?? ''}`
  );

const foldHomoglyphsToLatin = (text: string): string =>
  text.replace(WORD, (word) => {
    let latin = 0;
    let foldable = 0;
    let otherLetter = 0;
    let nonLetter = 0;
    for (const char of word) {
      if (LATIN.test(char)) latin += 1;
      else if (HOMOGLYPHS[char]) foldable += 1;
      else if (LETTER.test(char)) otherLetter += 1;
      else nonLetter += 1;
    }
    if (foldable === 0 || otherLetter > 0) return word;
    const mixedScript = latin > 0;
    const markedAsSymbol = latin === 0 && nonLetter > 0;
    if (!mixedScript && !markedAsSymbol) return word;
    return [...word].map((char) => HOMOGLYPHS[char] ?? char).join('');
  });

export const normalizeModelText = (text: string): string => {
  if (!text) return text;
  const script = detectDominantScript(text);

  if (script === 'cjk') return text;

  const folded = foldLatexDegrees(foldCompatibilityForms(text));
  if (script !== 'latin') return folded;
  return foldHomoglyphsToLatin(foldUnits(folded));
};
