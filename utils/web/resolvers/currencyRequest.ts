import {
  ECB_CURRENCY_CODES,
  UNAMBIGUOUS_CURRENCY_SYMBOLS,
} from '../../../constants/web-quotes';

export interface CurrencyRequest {
  amount: number;
  from: string;
  to: string;
}

interface CurrencyMention {
  code: string;
  start: number;
  end: number;
}

const CODES: ReadonlySet<string> = new Set(ECB_CURRENCY_CODES);

const CODE_PATTERN = /\p{L}{3}/gu;
const AMOUNT_PATTERN = /\d[\d\s.,']*\d|\d/gu;
const GAP_BETWEEN_AMOUNT_AND_CURRENCY = /^[\s]*$/u;
const GROUPED_TAIL = /^\d{3}$/u;

const escapeForPattern = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isLetter = (character: string | undefined): boolean =>
  character !== undefined && /\p{L}/u.test(character);

const SYMBOL_PATTERN = new RegExp(
  Object.keys(UNAMBIGUOUS_CURRENCY_SYMBOLS)
    .sort((a, b) => b.length - a.length)
    .map(escapeForPattern)
    .join('|'),
  'gu'
);

const symbolMentions = (question: string): CurrencyMention[] => {
  const found: CurrencyMention[] = [];
  for (const match of question.matchAll(SYMBOL_PATTERN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const startsWithLetter = isLetter(match[0][0]);
    const endsWithLetter = isLetter(match[0][match[0].length - 1]);
    if (startsWithLetter && isLetter(question[start - 1])) continue;
    if (endsWithLetter && isLetter(question[end])) continue;
    found.push({ code: UNAMBIGUOUS_CURRENCY_SYMBOLS[match[0]], start, end });
  }
  return found;
};

const codeMentions = (question: string): CurrencyMention[] => {
  const found: CurrencyMention[] = [];
  for (const match of question.matchAll(CODE_PATTERN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (isLetter(question[start - 1]) || isLetter(question[end])) continue;
    if (CODES.has(match[0])) found.push({ code: match[0], start, end });
  }
  return found;
};

export const parseAmount = (raw: string): number | undefined => {
  const compact = raw.replace(/[\s']/gu, '');
  const lastDot = compact.lastIndexOf('.');
  const lastComma = compact.lastIndexOf(',');
  const dots = (compact.match(/\./gu) ?? []).length;
  const commas = (compact.match(/,/gu) ?? []).length;

  let normalized: string;
  if (dots > 0 && commas > 0) {
    const decimalAt = Math.max(lastDot, lastComma);
    normalized =
      compact.slice(0, decimalAt).replace(/[.,]/gu, '') +
      '.' +
      compact.slice(decimalAt + 1);
  } else if (dots + commas === 0) {
    normalized = compact;
  } else if (dots + commas > 1) {
    normalized = compact.replace(/[.,]/gu, '');
  } else {
    const separatorAt = Math.max(lastDot, lastComma);
    const tail = compact.slice(separatorAt + 1);
    normalized = GROUPED_TAIL.test(tail)
      ? compact.replace(/[.,]/gu, '')
      : compact.slice(0, separatorAt) + '.' + tail;
  }

  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

const amountTouching = (
  question: string,
  mention: CurrencyMention
): number | undefined => {
  for (const match of question.matchAll(AMOUNT_PATTERN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const before =
      end <= mention.start &&
      GAP_BETWEEN_AMOUNT_AND_CURRENCY.test(question.slice(end, mention.start));
    const after =
      start >= mention.end &&
      GAP_BETWEEN_AMOUNT_AND_CURRENCY.test(question.slice(mention.end, start));
    if (before || after) return parseAmount(match[0]);
  }
  return undefined;
};

export const readCurrencyRequest = (
  question: string
): CurrencyRequest | undefined => {
  const mentions = [
    ...codeMentions(question),
    ...symbolMentions(question),
  ].sort((a, b) => a.start - b.start);
  const distinct = [...new Set(mentions.map((mention) => mention.code))];
  if (distinct.length !== 2) return undefined;

  for (const mention of mentions) {
    const amount = amountTouching(question, mention);
    if (amount !== undefined) {
      const other = distinct.find((code) => code !== mention.code);
      if (!other) return undefined;
      return { amount, from: mention.code, to: other };
    }
  }

  return { amount: 1, from: distinct[0], to: distinct[1] };
};
