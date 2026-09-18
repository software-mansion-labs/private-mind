import {
  FRANKFURTER_LATEST_URL,
  FRANKFURTER_SITE_URL,
  QUOTE_RESOLVER_MAX_BYTES,
  QUOTE_RESOLVER_TIMEOUT_MS,
} from '../../../constants/web-quotes';
import { fetchTextWithLimit } from '../security/outboundFetch';
import { readCurrencyRequest } from './currencyRequest';

export interface ResolvedQuote {
  id: string;
  text: string;
  sourceUrl: string;
  sourceTitle: string;
  asOf: string;
}

export type QuoteTextFetcher = (url: string) => Promise<string>;

export interface QuoteResolverOptions {
  signal?: AbortSignal;
  fetchText?: QuoteTextFetcher;
}

const JSON_CONTENT_TYPE = /json/i;

const DECIMALS_FOR_LARGE_VALUES = 2;
const SIGNIFICANT_DIGITS_FOR_SMALL_VALUES = 4;

const defaultFetchText =
  (signal?: AbortSignal): QuoteTextFetcher =>
  (url) =>
    fetchTextWithLimit(url, {
      timeoutMs: QUOTE_RESOLVER_TIMEOUT_MS,
      maxBytes: QUOTE_RESOLVER_MAX_BYTES,
      contentTypePattern: JSON_CONTENT_TYPE,
      ...(signal ? { signal } : {}),
    });

export const formatMoney = (value: number): string => {
  if (Number.isInteger(value)) return String(value);
  if (value >= 1) return value.toFixed(DECIMALS_FOR_LARGE_VALUES);
  return Number(
    value.toPrecision(SIGNIFICANT_DIGITS_FOR_SMALL_VALUES)
  ).toString();
};

const rateFrom = (payload: string, target: string): number | undefined => {
  const parsed: unknown = JSON.parse(payload);
  if (typeof parsed !== 'object' || parsed === null) return undefined;
  const { rates, date } = parsed as { rates?: unknown; date?: unknown };
  if (typeof date !== 'string') return undefined;
  if (typeof rates !== 'object' || rates === null) return undefined;
  const rate = (rates as Record<string, unknown>)[target];
  return typeof rate === 'number' && Number.isFinite(rate) ? rate : undefined;
};

const dateFrom = (payload: string): string | undefined => {
  const parsed: unknown = JSON.parse(payload);
  const { date } = (parsed ?? {}) as { date?: unknown };
  return typeof date === 'string' ? date : undefined;
};

export const resolveCurrencyQuote = async (
  question: string,
  options: QuoteResolverOptions = {}
): Promise<ResolvedQuote | undefined> => {
  const request = readCurrencyRequest(question);
  if (!request || request.from === request.to) return undefined;

  const url = `${FRANKFURTER_LATEST_URL}?base=${request.from}&symbols=${request.to}`;
  const fetchText = options.fetchText ?? defaultFetchText(options.signal);

  try {
    const payload = await fetchText(url);
    const rate = rateFrom(payload, request.to);
    const asOf = dateFrom(payload);
    if (rate === undefined || asOf === undefined) return undefined;

    const converted = formatMoney(request.amount * rate);
    const amount = formatMoney(request.amount);
    return {
      id: 'currency',
      text: `${amount} ${request.from} = ${converted} ${request.to} at the European Central Bank reference rate published ${asOf} (1 ${request.from} = ${formatMoney(rate)} ${request.to}).`,
      sourceUrl: FRANKFURTER_SITE_URL,
      sourceTitle: 'Frankfurter — European Central Bank reference rates',
      asOf,
    };
  } catch {
    return undefined;
  }
};
