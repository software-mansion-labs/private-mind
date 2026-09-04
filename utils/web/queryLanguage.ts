import { extractQueryTerms, foldForMatching } from '../queryTerms';
import { detectQuestionLanguage } from '../questionLanguage';
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

export const sharedStemCount = (query: string, text: string): number => {
  const known = termsIn(text);
  return termsIn(query).filter((term) =>
    known.some((word) => sharesStem(term, word))
  ).length;
};

const CODE_TOKEN =
  /(?<![\p{L}\p{N}])(?=[^\s]*\p{N})[\p{L}\p{N}-]{3,}(?![\p{L}\p{N}])/gu;

const carriesCodeFrom = (query: string, conversation: string): boolean => {
  const known = foldForMatching(conversation);
  return (query.match(CODE_TOKEN) ?? []).some((code) =>
    known.includes(foldForMatching(code))
  );
};

const detectedLanguagesDiffer = (
  query: string,
  conversation: string
): boolean => {
  const expected = detectQuestionLanguage(conversation)?.code;
  const actual = detectQuestionLanguage(query)?.code;
  return !!expected && !!actual && expected !== actual;
};

export const sharesLanguageWith = (
  query: string,
  conversation: string
): boolean => {
  const named = namedPartsOf(query);
  const queryTerms = termsIn(query).filter((term) => !named.has(term));
  if (queryTerms.length < JUDGEABLE_MIN_TERMS) {
    return (
      carriesCodeFrom(query, conversation) ||
      !detectedLanguagesDiffer(query, conversation)
    );
  }
  const known = termsIn(conversation);
  const shared = queryTerms.filter((term) =>
    known.some((word) => sharesStem(term, word))
  ).length;
  return shared / queryTerms.length >= SHARED_TERMS_MIN_RATIO;
};
