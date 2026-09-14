import type { WebSearchResult } from './types';
import { foldForMatching } from '../queryTerms';

const VARIANT_TOKENS = [
  'plus',
  'ultra',
  'pro',
  'max',
  'mini',
  'fe',
  'lite',
  'air',
  'se',
];

const VARIANT_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${VARIANT_TOKENS.join('|')}|\\+)(?![\\p{L}\\p{N}])`,
  'giu'
);

export const variantTokensIn = (text: string): string[] => [
  ...new Set(
    (foldForMatching(text).match(VARIANT_PATTERN) ?? []).map((token) =>
      token.trim().toLowerCase()
    )
  ),
];

export const addsUnaskedVariant = (title: string, query: string): boolean => {
  const asked = new Set(variantTokensIn(query));
  return variantTokensIn(title).some((token) => !asked.has(token));
};

export const demoteUnaskedVariants = <T extends WebSearchResult>(
  results: T[],
  query: string
): T[] => {
  if (results.length < 2) return results;
  const onModel = results.filter(
    (result) => !addsUnaskedVariant(result.title, query)
  );
  if (onModel.length === 0 || onModel.length === results.length) {
    return results;
  }
  return [
    ...onModel,
    ...results.filter((result) => addsUnaskedVariant(result.title, query)),
  ];
};
