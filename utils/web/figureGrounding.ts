export const VERIFIED_PRODUCT_MARKER = '[Verified product data]';

export const hasVerifiedProductData = (context: string): boolean =>
  context.includes(VERIFIED_PRODUCT_MARKER);

const CURRENCY_WORD =
  '(?:usd|eur|gbp|pln|zl|zł|chf|jpy|czk|inr|pkr|brl|rub|cny|rmb|mxn|sar|aed|irr)';
const CURRENCY_TOKEN_SRC = `[$€£¥₹₽]\\s?\\d(?:[\\d\\s.,]*\\d)?|\\d(?:[\\d\\s.,]*\\d)?\\s?${CURRENCY_WORD}(?![\\p{L}\\p{N}])`;
const CURRENCY_TOKEN = new RegExp(CURRENCY_TOKEN_SRC, 'giu');

const PRICE_STATEMENT = new RegExp(
  `(?:price|cena)[^.\\n]{0,25}?(${CURRENCY_TOKEN_SRC})`,
  'giu'
);

const normalizeFigure = (raw: string): number | null => {
  const compact = raw.replace(/[^\d.,]/g, '');
  if (!compact) return null;

  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');
  let normalized: string;
  if (lastComma !== -1 && lastDot !== -1) {
    normalized =
      lastDot > lastComma
        ? compact.replace(/,/g, '')
        : compact.replace(/\./g, '').replace(',', '.');
  } else if (lastComma !== -1) {
    const fractionLen = compact.length - lastComma - 1;
    normalized =
      fractionLen === 3 ? compact.replace(/,/g, '') : compact.replace(',', '.');
  } else if (lastDot !== -1) {
    const fractionLen = compact.length - lastDot - 1;
    normalized = fractionLen === 3 ? compact.replace(/\./g, '') : compact;
  } else {
    normalized = compact;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
};

export const extractCurrencyTokens = (text: string): string[] =>
  [...text.matchAll(CURRENCY_TOKEN)].map((m) => m[0].trim());

export { normalizeFigure };

export const extractPriceStatementTokens = (text: string): string[] =>
  [...text.matchAll(PRICE_STATEMENT)].map((m) => m[1]!.trim());

export const extractCurrencyFigures = (text: string): number[] =>
  extractCurrencyTokens(text)
    .map(normalizeFigure)
    .filter((n): n is number => n !== null);

const OUTLIER_RATIO = 3;

export const splitPriceOutliers = (
  tokens: string[]
): { typical: string[]; outliers: string[] } => {
  const parsed = tokens
    .map((token) => ({ token, value: normalizeFigure(token) }))
    .filter((t): t is { token: string; value: number } => t.value !== null);
  if (parsed.length < 3) return { typical: tokens, outliers: [] };

  const sortedValues = [...parsed].map((p) => p.value).sort((a, b) => a - b);
  const median = sortedValues[Math.floor(sortedValues.length / 2)]!;
  if (median <= 0) return { typical: tokens, outliers: [] };

  const outlierTokens = new Set(
    parsed
      .filter(
        (p) =>
          p.value < median / OUTLIER_RATIO || p.value > median * OUTLIER_RATIO
      )
      .map((p) => p.token)
  );
  if (outlierTokens.size === 0 || outlierTokens.size === parsed.length) {
    return { typical: tokens, outliers: [] };
  }

  return {
    typical: tokens.filter((t) => !outlierTokens.has(t)),
    outliers: tokens.filter((t) => outlierTokens.has(t)),
  };
};

const FIGURE_TOLERANCE_RATIO = 0.005;

const figuresMatch = (a: number, b: number): boolean => {
  if (a === b) return true;
  const diff = Math.abs(a - b);
  return diff < 1 || diff <= Math.max(a, b) * FIGURE_TOLERANCE_RATIO;
};

export const findUngroundedFigures = (
  answer: string,
  context: string
): number[] => {
  const answerFigures = extractCurrencyFigures(answer);
  if (answerFigures.length === 0) return [];

  const priceFigures = extractPriceStatementTokens(context)
    .map(normalizeFigure)
    .filter((n): n is number => n !== null);
  const contextFigures =
    priceFigures.length > 0 ? priceFigures : extractCurrencyFigures(context);
  if (contextFigures.length === 0) return answerFigures;

  return answerFigures.filter(
    (figure) => !contextFigures.some((source) => figuresMatch(figure, source))
  );
};

export const TREND_CLAIM_MARKERS =
  /procentowo|zmian[aeę] (?:w )?cen|(?:ostatni(?:ego|m)?|w tym) (?:miesi[ąa]c|tydzie[nń]|rok)|wzrosł|spadł|last (?:month|week|year)|this (?:month|week|year)|percent(?:age)? change|price change|gained (?:more|less)|risen|fallen/i;

const PERIOD_WORD = '(?:month|week|year|miesi[ąa]c|tydzie[nń]|rok)';
export const hasPeriodMatchedChangeData = (text: string): boolean =>
  new RegExp(`${PERIOD_WORD}[^%]{0,20}%|%[^%]{0,20}${PERIOD_WORD}`, 'i').test(
    text
  );

export const FOLLOWUP_CONVERSION_MARKERS =
  /how much is (?:that|it|this) in\b|what(?:'s| is) (?:that|it|this) in\b|convert (?:that|it|this) (?:to|into)\b|ile to (?:jest |będzie )?w (?:euro|dolar|funt|złot|frank)\w*|przelicz to na|w przeliczeniu na/i;

export const hasGenuineConversionRate = (context: string): boolean =>
  extractCurrencyFigures(context).some((figure) => figure !== 1);

const PLAUSIBLE_CONVERSION_RATIO_MIN = 0.1;
const PLAUSIBLE_CONVERSION_RATIO_MAX = 6;

export const isImplausibleConversionFigure = (
  anchorFigure: number,
  answerFigure: number
): boolean => {
  if (anchorFigure <= 0 || answerFigure <= 0) return false;
  const ratio = answerFigure / anchorFigure;
  return (
    ratio < PLAUSIBLE_CONVERSION_RATIO_MIN ||
    ratio > PLAUSIBLE_CONVERSION_RATIO_MAX
  );
};

export const isUngroundedConversionClaim = (
  answer: string,
  question: string | undefined,
  context: string,
  priorAnswerText?: string
): boolean => {
  if (!question || !FOLLOWUP_CONVERSION_MARKERS.test(question)) return false;
  const answerFigures = extractCurrencyFigures(answer);
  if (answerFigures.length === 0) return false;
  if (!hasGenuineConversionRate(context)) return true;
  const anchorFigures = extractCurrencyFigures(priorAnswerText ?? '');
  if (anchorFigures.length === 0) return false;
  const anchor = Math.max(...anchorFigures);
  return answerFigures.some((figure) =>
    isImplausibleConversionFigure(anchor, figure)
  );
};

const TREND_ASSERTION =
  /zyskał[ae]? (?:więcej|bardziej)|stracił[ae]? (?:więcej|bardziej)|wzrosł[ao]? (?:bardziej|więcej|znaczn)|spadł[ao]? (?:bardziej|więcej|znaczn)|zmiana .{0,25}(?:znaczna|duża|istotna|widoczna)|gained (?:more|less)|rose more|fell more|dropped more|(?:is|was) up more|(?:is|was) down more|significant change/i;

export const isUngroundedTrendClaim = (
  answer: string,
  question: string | undefined,
  context: string
): boolean =>
  !!question &&
  TREND_CLAIM_MARKERS.test(question) &&
  !hasPeriodMatchedChangeData(context) &&
  TREND_ASSERTION.test(answer);
