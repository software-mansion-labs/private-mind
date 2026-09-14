export const QUOTE_RESOLVER_TIMEOUT_MS = 4000;
export const QUOTE_RESOLVER_MAX_BYTES = 16 * 1024;

export const FRANKFURTER_LATEST_URL = 'https://api.frankfurter.dev/v1/latest';
export const FRANKFURTER_SITE_URL = 'https://frankfurter.dev';

export const ECB_CURRENCY_CODES = [
  'AUD',
  'BRL',
  'CAD',
  'CHF',
  'CNY',
  'CZK',
  'DKK',
  'EUR',
  'GBP',
  'HKD',
  'HUF',
  'IDR',
  'ILS',
  'INR',
  'ISK',
  'JPY',
  'KRW',
  'MXN',
  'MYR',
  'NOK',
  'NZD',
  'PHP',
  'PLN',
  'RON',
  'SEK',
  'SGD',
  'THB',
  'TRY',
  'USD',
  'ZAR',
] as const;

export const UNAMBIGUOUS_CURRENCY_SYMBOLS: Record<string, string> = {
  '€': 'EUR',
  '£': 'GBP',
  '₹': 'INR',
  '₺': 'TRY',
  '₩': 'KRW',
  '₪': 'ILS',
  'R$': 'BRL',
  'zł': 'PLN',
  'Kč': 'CZK',
  'Ft': 'HUF',
  '$': 'USD',
};
