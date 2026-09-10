import { foldForMatching } from '../queryTerms';

export const idfWeights = (folded: string[], needles: string[]): number[] =>
  needles.map((needle) => {
    const hits = folded.reduce(
      (count, passage) => count + (passage.includes(needle) ? 1 : 0),
      0
    );
    return hits === 0 ? 0 : Math.log(folded.length / hits);
  });

export const containsNeedle = (folded: string, needle: string): boolean =>
  needle.length >= 4
    ? folded.includes(needle)
    : new RegExp(`(?<![\\p{L}\\p{N}])${needle}`, 'u').test(folded);

const NUMERIC_DATE = '\\d{1,2}[.\\-/]\\d{1,2}[.\\-/]\\d{2,4}';
const ISO_DATE = '\\d{4}-\\d{2}-\\d{2}';
const MONTH_NAME = '\\p{L}[\\p{L}\\p{M}]{1,11}';
const DAY_MONTH_NAME_YEAR = `\\d{1,2}\\.?(?:\\s+${MONTH_NAME}\\.?){1,3}\\s+\\d{4}`;
const MONTH_NAME_DAY_YEAR = `${MONTH_NAME}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}`;

const SPACED_DATE = [
  ISO_DATE,
  NUMERIC_DATE,
  DAY_MONTH_NAME_YEAR,
  MONTH_NAME_DAY_YEAR,
].join('|');

const CJK_DATE =
  '\\d{1,4}\\s?\u5e74\\s?\\d{1,2}\\s?\u6708(?:\\s?\\d{1,2}\\s?\u65e5)?';

export const DATE_IN_TEXT = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${SPACED_DATE})(?!\\p{N})|(?<!\\p{N})(?:${CJK_DATE})(?!\\p{N})`,
  'iu'
);

export const MONEY_ANCHOR =
  /\d[\d\s.,]*\s?(?:zl(?:ot(?:ych|ego|emu|ymi|ym|y|e))?|pln|eur(?:o)?|usd|gbp|czk|chf|dolar(?:ow|ach|ami|em|a|y)?)(?![\p{L}\p{N}])|[$€£¥]\s?\d|\d\s?[$€£¥]/giu;

const MONEY_IN_TEXT = new RegExp(MONEY_ANCHOR.source, 'iu');

export const NUMBER_RUN = /\d[\d.,:]*\d|\d/g;

export const ENUMERATION_MIN_LINES = 3;

export const ENUMERATION_ITEM_MAX_CHARS = 90;

export const ENUMERATION_MARKER =
  /^(?:[-\u2013\u2014\u2022*\u00b7\u25aa]|\d+[.)]|\d+(?:[.,/]\d+)?\s+\p{L})/u;

export const LABELLED_FIELD = /^\p{L}[^:\n]{0,40}:\s*\S/u;

export const MEASURED_QUANTITY =
  /(?<![\p{L}\p{N}])\d+(?:[.,/]\d+)?\s?(?:\p{L}{1,3}|%|\u00b0\p{L}?)(?![\p{L}])/u;

export const INLINE_CELL_SEPARATOR = /\s[|\u2022\u00b7]\s/;

export const enumerationUnits = (text: string): string[] =>
  text
    .split('\n')
    .flatMap((line) => line.split(INLINE_CELL_SEPARATOR))
    .map((unit) => unit.trim())
    .filter(Boolean);

export const isEnumerationItem = (unit: string): boolean =>
  unit.length <= ENUMERATION_ITEM_MAX_CHARS &&
  (ENUMERATION_MARKER.test(unit) ||
    LABELLED_FIELD.test(unit) ||
    MEASURED_QUANTITY.test(unit));

export const enumerationShare = (text: string): number => {
  const units = enumerationUnits(text);
  if (units.length < ENUMERATION_MIN_LINES) return 0;
  return units.filter(isEnumerationItem).length / units.length;
};

export const LIST_HEADING = /^\p{L}[^:\n]{0,60}:\s*$/u;

export const listHeadingAnswers = (
  text: string,
  needles: string[],
  titleNeedles: ReadonlySet<string>
): boolean => {
  const asked = needles.filter((needle) => !titleNeedles.has(needle));
  if (asked.length === 0) return false;
  const units = enumerationUnits(text);
  return units.some((unit, index) => {
    if (!LIST_HEADING.test(unit)) return false;
    const following = units.slice(index + 1, index + 1 + ENUMERATION_MIN_LINES);
    if (
      following.length < ENUMERATION_MIN_LINES ||
      !following.every((line) => line.length <= ENUMERATION_ITEM_MAX_CHARS) ||
      !following.some(isEnumerationItem)
    ) {
      return false;
    }
    const folded = foldForMatching(unit);
    return asked.some((needle) => containsNeedle(folded, needle));
  });
};

const LABELLED_VALUE = /^(\p{L}[^:\n]{0,40}):\s*(\S.*)$/u;

export const datedFieldAnswers = (
  text: string,
  needles: string[],
  titleNeedles: ReadonlySet<string>
): boolean => {
  const asked = needles.filter((needle) => !titleNeedles.has(needle));
  if (asked.length === 0) return false;
  return enumerationUnits(text).some((unit) => {
    const labelled = LABELLED_VALUE.exec(unit);
    if (!labelled || !DATE_IN_TEXT.test(labelled[2]!)) return false;
    const folded = foldForMatching(labelled[1]!);
    return asked.some((needle) => containsNeedle(folded, needle));
  });
};

const QUOTED_PRICE_MIN_SHARE = 0.15;

export const quotesPrices = (text: string): boolean => {
  const units = enumerationUnits(text);
  if (units.length === 0) return false;
  const priced = units.filter((unit) =>
    MONEY_IN_TEXT.test(foldForMatching(unit))
  );
  return priced.length / units.length >= QUOTED_PRICE_MIN_SHARE;
};

export const figuresOutsideNeedles = (
  folded: string,
  needles: string[]
): number => {
  const rest = needles.reduce(
    (text, needle) => text.split(needle).join(' '),
    folded
  );
  return (rest.match(NUMBER_RUN) ?? []).length;
};

export const RECORD_LINE =
  /^(?=[^:|\n]{0,40}\p{L})([^:|\n]{2,40}?)\s*[:|]\s*(\S.{0,79})$/u;

export const RECORD_KEY_MAX_REPEATS = 2;

export const recordKeys = (passage: string): string[] =>
  passage
    .split('\n')
    .map((line) => line.trim().match(RECORD_LINE)?.[1])
    .filter((key): key is string => key !== undefined)
    .map((key) => foldForMatching(key));

export const creditedRecords = (passages: string[]): Set<number> => {
  const keysOf = passages.map(recordKeys);
  const keyCount = new Map<string, number>();
  keysOf
    .flat()
    .forEach((key) => keyCount.set(key, (keyCount.get(key) ?? 0) + 1));
  const isRecordLine = (index: number): boolean =>
    index >= 0 &&
    index < passages.length &&
    keysOf[index]!.length === 1 &&
    !passages[index]!.includes('\n');
  const credited = new Set<number>();
  keysOf.forEach((keys, index) => {
    const structured =
      keys.length >= 2 ||
      (isRecordLine(index) &&
        (isRecordLine(index - 1) || isRecordLine(index + 1)));
    const distinct = keys.some(
      (key) => keyCount.get(key)! <= RECORD_KEY_MAX_REPEATS
    );
    if (structured && distinct) credited.add(index);
  });
  return credited;
};

export const parseAmount = (text: string): number | null => {
  const digits = text.match(/\d[\d\s.,]*/)?.[0].replace(/\s/g, '');
  if (!digits) return null;
  const decimal = digits.match(/[.,](\d{1,2})$/);
  const whole = (
    decimal ? digits.slice(0, -decimal[0].length) : digits
  ).replace(/[.,]/g, '');
  const value = Number(`${whole}.${decimal?.[1] ?? '0'}`);
  return Number.isFinite(value) ? value : null;
};

export const AMOUNT_TOLERANCE = 0.005;

export const isOtherAmount = (
  mention: string,
  verified: number | null
): boolean => {
  if (verified === null) return false;
  const amount = parseAmount(mention);
  return (
    amount !== null && Math.abs(amount - verified) > verified * AMOUNT_TOLERANCE
  );
};
