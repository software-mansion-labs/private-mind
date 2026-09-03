import type { WebSearchResult } from './types';

export const hasVerifiedPrice = (result: WebSearchResult): boolean =>
  !!result.product?.price?.trim();

export const promoteVerifiedProducts = <T extends WebSearchResult>(
  results: T[]
): T[] => {
  if (results.length < 2) return results;
  const verified = results.filter(hasVerifiedPrice);
  if (verified.length === 0 || verified.length === results.length) {
    return results;
  }
  return [
    ...verified,
    ...results.filter((result) => !hasVerifiedPrice(result)),
  ];
};
