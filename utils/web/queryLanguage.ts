import { extractQueryTerms, foldForMatching } from '../queryTerms';
import { namedEntitiesIn } from './conversationSubject';

const CONTENT_TERM_MIN_CHARS = 4;
const SHARED_STEM_MIN_CHARS = 3;
const INFLECTION_MAX_CHARS = 1;
const JUDGEABLE_MIN_TERMS = 2;
const SHARED_TERMS_MIN_RATIO = 0.5;

const termsIn = (text: string): string[] =>
  [...extractQueryTerms(foldForMatching(text))].filter(
    (term) => term.length >= CONTENT_TERM_MIN_CHARS && !/\p{N}/u.test(term)
  );

const namedPartsOf = (query: string): Set<string> =>
  new Set(
    namedEntitiesIn(query)
      .filter((entity) => entity.trim() !== query.trim())
      .flatMap((entity) => termsIn(entity))
  );

const commonPrefixLength = (a: string, b: string): number => {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n += 1;
  return n;
};

const sharesStem = (a: string, b: string): boolean =>
  commonPrefixLength(a, b) >=
  Math.max(
    SHARED_STEM_MIN_CHARS,
    Math.min(a.length, b.length) - INFLECTION_MAX_CHARS
  );

export const sharesLanguageWith = (
  query: string,
  conversation: string
): boolean => {
  const named = namedPartsOf(query);
  const queryTerms = termsIn(query).filter((term) => !named.has(term));
  if (queryTerms.length < JUDGEABLE_MIN_TERMS) return true;
  const known = termsIn(conversation);
  const shared = queryTerms.filter((term) =>
    known.some((word) => sharesStem(term, word))
  ).length;
  return shared / queryTerms.length >= SHARED_TERMS_MIN_RATIO;
};
