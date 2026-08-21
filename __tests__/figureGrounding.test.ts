import {
  extractCurrencyTokens,
  extractCurrencyFigures,
  extractPriceStatementTokens,
  findUngroundedFigures,
  hasGenuineConversionRate,
  isUngroundedConversionClaim,
  splitPriceOutliers,
} from '../utils/web/figureGrounding';

describe('extractCurrencyFigures', () => {
  it('parses a comma-thousands, dot-decimal figure', () => {
    expect(extractCurrencyFigures('$64,146.36')).toEqual([64146.36]);
  });

  it('parses a dot-thousands, comma-decimal (European) figure', () => {
    expect(extractCurrencyFigures('1.901,25 EUR')).toEqual([1901.25]);
  });

  it('parses a plain thousands figure with no decimals', () => {
    expect(extractCurrencyFigures('$50,000')).toEqual([50000]);
  });

  it('parses a space-grouped figure with a comma decimal', () => {
    expect(extractCurrencyFigures('1 901,25 USD')).toEqual([1901.25]);
  });

  it('parses a currency-word suffix in Polish', () => {
    expect(extractCurrencyFigures('5000 zł')).toEqual([5000]);
  });

  it('extracts every figure in a longer passage', () => {
    expect(
      extractCurrencyFigures('Bitcoin: $64,146.36. Ethereum: $1,901.25.')
    ).toEqual([64146.36, 1901.25]);
  });

  it('returns an empty array when there are no currency figures', () => {
    expect(extractCurrencyFigures('The sky is blue today.')).toEqual([]);
  });

  it('ignores plain numbers without a currency marker', () => {
    expect(extractCurrencyFigures('It happened in 2023, article 42.')).toEqual(
      []
    );
  });
});

describe('extractCurrencyTokens', () => {
  it('returns the original matched substrings, not normalized numbers', () => {
    expect(extractCurrencyTokens('Price: $1,901.25 today')).toEqual([
      '$1,901.25',
    ]);
  });
});

describe('extractPriceStatementTokens', () => {
  it('extracts the figure right after "price"', () => {
    expect(
      extractPriceStatementTokens(
        'The live Ethereum price today is $1,913.14 USD'
      )
    ).toEqual(['$1,913.14']);
  });

  it('extracts the figure right after Polish "cena"', () => {
    expect(
      extractPriceStatementTokens('Aktualna cena bitcoina to $64,146.36')
    ).toEqual(['$64,146.36']);
  });

  it('ignores a figure that merely sits near the word "price" but comes before it', () => {
    expect(
      extractPriceStatementTokens(
        '91952 ETH, or $6960 in Ethereum price today. This number will change.'
      )
    ).toEqual([]);
  });

  it('ignores currency figures with no "price"/"cena" governing them at all', () => {
    expect(
      extractPriceStatementTokens(
        '50 ETH is worth 1.4744 BTC in the converter table'
      )
    ).toEqual([]);
  });

  it('returns an empty array when there is no currency figure', () => {
    expect(
      extractPriceStatementTokens('The price is unknown right now.')
    ).toEqual([]);
  });
});

describe('splitPriceOutliers', () => {
  it('flags a figure far below the cluster of the others (F15)', () => {
    const tokens = ['399 zł', '2199 zł', '2349 zł', '2599 zł'];
    expect(splitPriceOutliers(tokens)).toEqual({
      typical: ['2199 zł', '2349 zł', '2599 zł'],
      outliers: ['399 zł'],
    });
  });

  it('flags a figure far above the cluster of the others', () => {
    const tokens = ['64 zł', '65 zł', '108 zł', '9999 zł'];
    expect(splitPriceOutliers(tokens)).toEqual({
      typical: ['64 zł', '65 zł', '108 zł'],
      outliers: ['9999 zł'],
    });
  });

  it('finds no outlier when figures cluster within a normal range', () => {
    const tokens = ['$65', '$108.97', '$121.97', '$145', '$150', '$160'];
    expect(splitPriceOutliers(tokens)).toEqual({
      typical: tokens,
      outliers: [],
    });
  });

  it('does nothing with fewer than 3 figures — no cluster to compare against', () => {
    expect(splitPriceOutliers(['399 zł', '2199 zł'])).toEqual({
      typical: ['399 zł', '2199 zł'],
      outliers: [],
    });
  });
});

describe('findUngroundedFigures', () => {
  it('flags a figure the answer states that is nowhere in the context', () => {
    const context =
      '--- Source 1 ---\nEthereum Price: $1,901.25 (0.20%) | ETH\n--- End of Source 1 ---';
    const answer = 'Aktualna cena Ethereum wynosi około $50,000 USD.';
    expect(findUngroundedFigures(answer, context)).toEqual([50000]);
  });

  it('does not flag a figure that is genuinely in the context', () => {
    const context = 'Bitcoin price today: $64,146.36 USD.';
    const answer = 'Aktualna cena Bitcoin wynosi około $64,146.36 USD.';
    expect(findUngroundedFigures(answer, context)).toEqual([]);
  });

  it('tolerates minor rounding between the source and the answer', () => {
    const context = 'Ethereum trades at $1,901.25 right now.';
    const answer = 'Ethereum is trading around $1,901 today.';
    expect(findUngroundedFigures(answer, context)).toEqual([]);
  });

  it('returns nothing when the answer states no currency figure', () => {
    expect(
      findUngroundedFigures('It is sunny in Warsaw today.', 'Some context.')
    ).toEqual([]);
  });

  it('flags every stated figure when the context has no currency figures at all', () => {
    const answer = 'The ticket costs $50.';
    expect(findUngroundedFigures(answer, 'No prices mentioned here.')).toEqual([
      50,
    ]);
  });

  it('still returns nothing when the answer states no currency figure either', () => {
    expect(
      findUngroundedFigures('I have no price for that.', 'No prices here.')
    ).toEqual([]);
  });

  it('flags a real figure from the page that the price statement does not govern (F8)', () => {
    const context =
      'Apple iPhone 17 Pro 256GB Srebrny. Cena: 5 147,00 zł. ' +
      'Kup teraz, zapłać w 24 ratach po 156,08 zł miesięcznie (razem 3 746,00 zł odsetek).';
    const answer =
      'Aktualna cena iPhone 17 Pro 256GB w Polsce wynosi 3 746,00 zł.';
    expect(findUngroundedFigures(answer, context)).toEqual([3746]);
  });
});

describe('hasGenuineConversionRate', () => {
  it('returns false when context only has "1 <currency>" boilerplate', () => {
    const context =
      '1 USD to EUR - Convert US dollars to Euros | Wise. ' +
      '1 Euro to US dollars Exchange Rate. Convert EUR/USD - Wise.';
    expect(hasGenuineConversionRate(context)).toBe(false);
  });

  it('returns true when context has a figure other than 1', () => {
    expect(hasGenuineConversionRate('1 USD = 0.92 EUR as of today.')).toBe(
      true
    );
  });

  it('returns false when context has no currency figures at all', () => {
    expect(hasGenuineConversionRate('No exchange rate data here.')).toBe(false);
  });
});

describe('isUngroundedConversionClaim', () => {
  const question = 'And how much is that in euros?';
  const noRateContext =
    '1 USD to EUR - Convert US dollars to Euros | Wise. ' +
    '1 Euro to US dollars Exchange Rate. Convert EUR/USD - Wise.';

  it('flags a stated conversion figure when context has no genuine rate', () => {
    const answer = 'The price of 1 USD in euros is 1.00.';
    expect(isUngroundedConversionClaim(answer, question, noRateContext)).toBe(
      true
    );
  });

  it('does not flag it when context has a genuine rate', () => {
    const answer = 'That is approximately €1,450.00.';
    expect(
      isUngroundedConversionClaim(
        answer,
        question,
        '1 USD = 0.92 EUR as of today.'
      )
    ).toBe(false);
  });

  it('does not flag an answer with no currency figure', () => {
    const answer = 'I do not have a verified exchange rate to convert that.';
    expect(isUngroundedConversionClaim(answer, question, noRateContext)).toBe(
      false
    );
  });

  it('does not flag a question that is not a conversion follow-up', () => {
    const answer = 'The price of 1 USD in euros is 1.00.';
    expect(
      isUngroundedConversionClaim(
        answer,
        'What is the current gold price?',
        noRateContext
      )
    ).toBe(false);
  });
});
