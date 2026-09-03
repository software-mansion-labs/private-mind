import {
  hasVerifiedPrice,
  promoteVerifiedProducts,
} from '../utils/web/promoteVerified';
import type { WebSearchResult } from '../utils/web/types';

const listing = (url: string): WebSearchResult => ({
  title: 'Samsung Galaxy S25 - niskie ceny i setki opinii',
  url,
  snippet: 'Drugi -30% lub piąty za 1 zł!',
});

const productPage = (url: string, price: string): WebSearchResult => ({
  title: 'Samsung Galaxy S25 12/128GB',
  url,
  snippet: 'specs',
  product: { name: 'Samsung Galaxy S25 12/128GB', price, currency: 'PLN' },
});

describe('promoteVerifiedProducts', () => {
  it('puts the page whose price came from structured data first (live-found: "costs 1 zł")', () => {
    const ranked = promoteVerifiedProducts([
      listing('https://mediaexpert.pl/lista'),
      listing('https://allegro.pl/lista'),
      productPage('https://euro.com.pl/s25', '3199'),
    ]);
    expect(ranked.map((r) => r.url)).toEqual([
      'https://euro.com.pl/s25',
      'https://mediaexpert.pl/lista',
      'https://allegro.pl/lista',
    ]);
  });

  it('keeps the order when none or all of them are verified', () => {
    const none = [listing('https://a.example'), listing('https://b.example')];
    expect(promoteVerifiedProducts(none)).toBe(none);
    const all = [
      productPage('https://a.example', '10'),
      productPage('https://b.example', '20'),
    ];
    expect(promoteVerifiedProducts(all)).toBe(all);
  });

  it('does not count a product record with no price as verified', () => {
    expect(
      hasVerifiedPrice({
        title: 't',
        url: 'https://a.example',
        snippet: 's',
        product: { name: 'X' },
      })
    ).toBe(false);
    expect(hasVerifiedPrice(listing('https://a.example'))).toBe(false);
  });
});
