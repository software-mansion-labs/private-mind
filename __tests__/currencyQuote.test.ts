import {
  parseAmount,
  readCurrencyRequest,
} from '../utils/web/resolvers/currencyRequest';
import {
  formatMoney,
  resolveCurrencyQuote,
} from '../utils/web/resolvers/currencyQuote';

describe('reading a conversion out of a question, whatever language it is in', () => {
  it('reads the same request from English, Polish, German and Hindi', () => {
    const expected = { amount: 100, from: 'USD', to: 'EUR' };
    expect(readCurrencyRequest('How much is 100 USD in EUR?')).toEqual(
      expected
    );
    expect(readCurrencyRequest('Ile to jest 100 USD w EUR?')).toEqual(expected);
    expect(readCurrencyRequest('Wie viel sind 100 USD in EUR?')).toEqual(
      expected
    );
    expect(readCurrencyRequest('100 USD से EUR कितना है?')).toEqual(expected);
  });

  it('takes the currency the amount is attached to as the source, not the first one named', () => {
    expect(readCurrencyRequest('How many EUR is 100 USD?')).toEqual({
      amount: 100,
      from: 'USD',
      to: 'EUR',
    });
  });

  it('accepts the amount on either side of the code', () => {
    expect(readCurrencyRequest('USD 100 to EUR')).toEqual({
      amount: 100,
      from: 'USD',
      to: 'EUR',
    });
  });

  it('reads a symbol that can only mean one currency', () => {
    expect(readCurrencyRequest('100 zł w EUR')).toEqual({
      amount: 100,
      from: 'PLN',
      to: 'EUR',
    });
    expect(readCurrencyRequest('£50 in PLN')).toEqual({
      amount: 50,
      from: 'GBP',
      to: 'PLN',
    });
  });

  it('falls back to a rate for one unit when no amount is given', () => {
    expect(readCurrencyRequest('USD EUR')).toEqual({
      amount: 1,
      from: 'USD',
      to: 'EUR',
    });
  });

  it('refuses a question that names a third currency, so a word like "try" cannot hijack it', () => {
    expect(
      readCurrencyRequest('Can you try to convert 100 USD to EUR?')
    ).toBeUndefined();
  });

  it('refuses a question with fewer than two currencies', () => {
    expect(readCurrencyRequest('How much is 100 USD?')).toBeUndefined();
    expect(readCurrencyRequest('What is the weather today?')).toBeUndefined();
    expect(readCurrencyRequest('Convert 100 USD into USD')).toBeUndefined();
  });

  it('does not read a code out of a longer word', () => {
    expect(readCurrencyRequest('Is USDA part of EUR policy?')).toBeUndefined();
    expect(readCurrencyRequest('USDA reports 100 USD in EUR')).toEqual({
      amount: 100,
      from: 'USD',
      to: 'EUR',
    });
  });
});

describe('reading an amount written the way each locale writes it', () => {
  it('treats a lone separator with three trailing digits as grouping', () => {
    expect(parseAmount('1,500')).toBe(1500);
    expect(parseAmount('1.500')).toBe(1500);
  });

  it('treats a lone separator with one or two trailing digits as a decimal point', () => {
    expect(parseAmount('1,5')).toBe(1.5);
    expect(parseAmount('1.75')).toBe(1.75);
  });

  it('takes the last separator as the decimal point when both appear', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('1,234.56')).toBe(1234.56);
  });

  it('ignores spaces and apostrophes used as digit grouping', () => {
    expect(parseAmount('1 234 567')).toBe(1234567);
    expect(parseAmount("1'234'567")).toBe(1234567);
  });

  it('rejects an amount that is not a positive number', () => {
    expect(parseAmount('0')).toBeUndefined();
  });
});

describe('answering a conversion from the reference rate instead of a search page', () => {
  const payload = JSON.stringify({
    amount: 1,
    base: 'USD',
    date: '2026-09-09',
    rates: { EUR: 0.85822 },
  });

  it('asks the rate service for exactly the pair the question named', async () => {
    const fetchText = jest.fn().mockResolvedValue(payload);
    await resolveCurrencyQuote('How much is 100 USD in EUR?', { fetchText });
    expect(fetchText).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR'
    );
  });

  it('states the converted amount, the unit rate and the day the rate is from', async () => {
    const quote = await resolveCurrencyQuote('How much is 100 USD in EUR?', {
      fetchText: () => Promise.resolve(payload),
    });
    expect(quote?.text).toBe(
      '100 USD = 85.82 EUR at the European Central Bank reference rate published 2026-09-09 (1 USD = 0.8582 EUR).'
    );
    expect(quote?.asOf).toBe('2026-09-09');
    expect(quote?.sourceUrl).toBe('https://frankfurter.dev');
  });

  it('never calls out for a question that names no pair', async () => {
    const fetchText = jest.fn();
    expect(
      await resolveCurrencyQuote('What is the weather today?', { fetchText })
    ).toBeUndefined();
    expect(fetchText).not.toHaveBeenCalled();
  });

  it('gives up quietly when the service fails, so the search path still runs', async () => {
    expect(
      await resolveCurrencyQuote('100 USD in EUR', {
        fetchText: () => Promise.reject(new Error('offline')),
      })
    ).toBeUndefined();
  });

  it('gives up quietly when the payload is not the shape it expects', async () => {
    expect(
      await resolveCurrencyQuote('100 USD in EUR', {
        fetchText: () => Promise.resolve('{"rates":{"EUR":"soon"}}'),
      })
    ).toBeUndefined();
  });
});

describe('showing a converted amount', () => {
  it('keeps whole numbers whole and money to two places', () => {
    expect(formatMoney(1500)).toBe('1500');
    expect(formatMoney(85.8216)).toBe('85.82');
  });

  it('keeps enough digits for a rate far below one', () => {
    expect(formatMoney(0.0067123)).toBe('0.006712');
  });
});
