import { anchorTokens } from './anchorTokens';
import { foldForMatching } from '../queryTerms';
import { detectQuestionLanguage } from '../questionLanguage';
import {
  COORDINATION_LEXICONS,
  DEFAULT_COORDINATION_LANGUAGE,
  type CoordinationLexicon,
} from './coordinationLexicon';

const FIXED_PAIRS = new Set([
  'antigua and barbuda',
  'black and white',
  'bosnia and herzegovina',
  'crime and punishment',
  'fish and chips',
  'johnson and johnson',
  'kitts and nevis',
  'law and order',
  'marks and spencer',
  'pride and prejudice',
  'procter and gamble',
  'research and development',
  'rock and roll',
  'romeo and juliet',
  'salt and pepper',
  'sense and sensibility',
  'tome and principe',
  'trinidad and tobago',
  'war and peace',
]);

const MAX_QUESTION_PARTS = 2;
const MIN_SHARED_CONTEXT_WORDS = 2;

interface Lexicon {
  conjunctions: Set<string>;
  questionWords: Set<string>;
  adpositions: Set<string>;
  functionWords: Set<string>;
  objectPronouns: Set<string>;
  questionWordLeadsClause: boolean;
}

const toLexicon = (source: CoordinationLexicon): Lexicon => ({
  conjunctions: new Set(source.conjunctions),
  questionWords: new Set(source.questionWords),
  adpositions: new Set(source.adpositions),
  functionWords: new Set([
    ...source.adpositions,
    ...source.questionWords,
    ...source.functionWords,
  ]),
  objectPronouns: new Set(source.objectPronouns),
  questionWordLeadsClause: source.questionWordLeadsClause,
});

const LEXICONS = new Map(
  Object.entries(COORDINATION_LEXICONS).map(([code, source]) => [
    code,
    toLexicon(source),
  ])
);

const bare = (word: string): string =>
  word
    .toLowerCase()
    .replace(/^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}'’]+$/gu, '');

const isCapitalised = (word: string): boolean => /^[\p{Lu}\p{Lt}]/u.test(word);

const capitalisedRunEndingAt = (words: string[], end: number): number => {
  let start = end;
  while (start > 0 && isCapitalised(words[start - 1]!)) start -= 1;
  return start;
};

const capitalisedRunStartingAt = (words: string[], start: number): number => {
  let end = start;
  while (end + 1 < words.length && isCapitalised(words[end + 1]!)) end += 1;
  return end;
};

const join = (...groups: string[][]): string =>
  groups
    .flat()
    .join(' ')
    .replace(/\s+([,;:])/g, '$1')
    .replace(/[,;:]+$/, '')
    .trim();

const skipFunctionWords = (
  words: string[],
  from: number,
  lexicon: Lexicon
): number => {
  let at = from;
  while (at < words.length && lexicon.functionWords.has(bare(words[at]!))) {
    at += 1;
  }
  return at;
};

const stripTrailingPunctuation = (words: string[]): string[] =>
  words.map((word, index) =>
    index === words.length - 1 ? word.replace(/[,;:]+$/, '') : word
  );

const stripLeadingQuestionPhrase = (
  words: string[],
  lexicon: Lexicon
): string[] => {
  let start = skipFunctionWords(words, 0, lexicon);
  if (start > 0 && start < words.length && !isCapitalised(words[start]!)) {
    start = skipFunctionWords(words, start + 1, lexicon);
  }
  return stripTrailingPunctuation(words.slice(start));
};

const contentWordsOf = (words: string[], lexicon: Lexicon): string[] =>
  stripTrailingPunctuation(
    words.filter((word) => !lexicon.functionWords.has(bare(word)))
  );

const subjectOf = (left: string[], lexicon: Lexicon): string[] =>
  lexicon.questionWordLeadsClause
    ? stripLeadingQuestionPhrase(left, lexicon)
    : contentWordsOf(left, lexicon);

const askAboutSubject = (
  clause: string[],
  subject: string[],
  lexicon: Lexicon
): string[] => {
  const pronounAt = clause.findIndex(
    (word, index) =>
      (index > 0 || !lexicon.questionWordLeadsClause) &&
      lexicon.objectPronouns.has(bare(word))
  );
  if (pronounAt < 0) return [...clause, ...subject];
  return [
    ...clause.slice(0, pronounAt),
    ...subject,
    ...clause.slice(pronounAt + 1),
  ];
};

const clauseParts = (
  left: string[],
  right: string[],
  lexicon: Lexicon
): string[] => {
  const subject = subjectOf(left, lexicon);
  if (subject.length === 0 || right.length < 2) return [];
  return [join(left), join(askAboutSubject(right, subject, lexicon))];
};

const partsAround = (
  shared: string[],
  x: string[],
  y: string[],
  tail: string[]
): string[] =>
  shared.length + tail.length >= MIN_SHARED_CONTEXT_WORDS
    ? [join(shared, x, tail), join(shared, y, tail)]
    : [];

const MAX_ADPOSITION_PHRASE_WORDS = 3;

const repeatedPrepositionLength = (
  left: string[],
  right: string[],
  lexicon: Lexicon
): number => {
  const opening = bare(right[0]!);
  if (!lexicon.adpositions.has(opening)) return 0;
  for (let length = 2; length <= MAX_ADPOSITION_PHRASE_WORDS; length += 1) {
    if (left.length >= length && bare(left.at(-length)!) === opening) {
      return right.length >= length ? length : 0;
    }
  }
  return 0;
};

const repeatsPostposition = (
  left: string[],
  right: string[],
  lexicon: Lexicon
): boolean => {
  const closing = bare(left.at(-1)!);
  return (
    left.length >= 2 &&
    right.length >= 2 &&
    lexicon.adpositions.has(closing) &&
    bare(right[1]!) === closing
  );
};

const repeatedAdpositionParts = (
  left: string[],
  right: string[],
  lexicon: Lexicon
): string[] | null => {
  const length = repeatsPostposition(left, right, lexicon)
    ? 2
    : repeatedPrepositionLength(left, right, lexicon);
  if (length === 0) return null;
  return partsAround(
    left.slice(0, -length),
    left.slice(-length),
    right.slice(0, length),
    right.slice(length)
  );
};

const coordinatedParts = (
  left: string[],
  right: string[],
  lexicon: Lexicon
): string[] => {
  const lastLeft = left.length - 1;

  const aroundAdposition = repeatedAdpositionParts(left, right, lexicon);
  if (aroundAdposition) return aroundAdposition;

  if (
    lexicon.functionWords.has(bare(right[0]!)) ||
    lexicon.functionWords.has(bare(left[lastLeft]!))
  ) {
    return [];
  }

  if (isCapitalised(right[0]!) && isCapitalised(left[lastLeft]!)) {
    const xStart = capitalisedRunEndingAt(left, lastLeft);
    const yEnd = capitalisedRunStartingAt(right, 0);
    const bothSingleWords = xStart === lastLeft && yEnd === 0;
    const afterPreposition =
      xStart > 0 && lexicon.adpositions.has(bare(left[xStart - 1]!));
    if (bothSingleWords && !afterPreposition) return [];
    return partsAround(
      left.slice(0, xStart),
      left.slice(xStart),
      right.slice(0, yEnd + 1),
      right.slice(yEnd + 1)
    );
  }

  const tail = right.slice(1);
  if (tail.length === 0) return [];
  return partsAround(
    left.slice(0, lastLeft),
    left.slice(lastLeft),
    right.slice(0, 1),
    tail
  );
};

interface Coordination {
  left: string[];
  conjunction: string;
  right: string[];
  lexicon: Lexicon;
}

const QUESTION_MARKS = /[?¿!؟;]+/g;

const findCoordination = (question: string): Coordination | null => {
  const language =
    detectQuestionLanguage(question)?.code ?? DEFAULT_COORDINATION_LANGUAGE;
  const lexicon = LEXICONS.get(language);
  if (!lexicon) return null;
  const words = question.replace(QUESTION_MARKS, ' ').trim().split(/\s+/);
  const at = words.findIndex(
    (word, index) => index > 0 && lexicon.conjunctions.has(bare(word))
  );
  if (at <= 0 || at >= words.length - 1) return null;
  return {
    left: words.slice(0, at),
    conjunction: words[at]!,
    right: words.slice(at + 1),
    lexicon,
  };
};

const asksSomething = (words: string[], lexicon: Lexicon): boolean =>
  words.some((word) => lexicon.questionWords.has(bare(word)));

const opensClause = (
  left: string[],
  right: string[],
  lexicon: Lexicon
): boolean =>
  lexicon.questionWordLeadsClause
    ? lexicon.questionWords.has(bare(right[0]!))
    : asksSomething(left, lexicon) && asksSomething(right, lexicon);

const matchableWords = (text: string): string =>
  foldForMatching(text)
    .split(/[^\p{L}\p{M}\p{N}'’]+/u)
    .filter(Boolean)
    .join(' ');

const coordinatedPhrase = ({ left, conjunction, right }: Coordination) =>
  matchableWords(`${left.at(-1)!} ${conjunction} ${right[0]!}`);

const namesOneThing = (coordination: Coordination): boolean =>
  FIXED_PAIRS.has(coordinatedPhrase(coordination));

export const splitQuestionParts = (question: string): string[] => {
  const coordination = findCoordination(question);
  if (!coordination || namesOneThing(coordination)) return [];
  const { left, right, lexicon } = coordination;
  const parts = opensClause(left, right, lexicon)
    ? clauseParts(left, right, lexicon)
    : coordinatedParts(left, right, lexicon);
  const distinct = [...new Set(parts.filter(Boolean))];
  return distinct.length >= 2 ? distinct.slice(0, MAX_QUESTION_PARTS) : [];
};

const plannerKeptPhraseTogether = (
  question: string,
  plannedQuery: string,
  toKeywords: (text: string) => string
): boolean => {
  const coordination = findCoordination(question);
  const planned = matchableWords(plannedQuery);
  const plannerRewroteQuestion =
    planned !== matchableWords(toKeywords(question));
  if (!coordination || !plannerRewroteQuestion) return false;
  return ` ${planned} `.includes(` ${coordinatedPhrase(coordination)} `);
};

export const partQueriesFor = (
  question: string,
  plannedQuery: string,
  toKeywords: (text: string) => string
): string[] => {
  if (plannerKeptPhraseTogether(question, plannedQuery, toKeywords)) return [];
  const asked = new Set(
    question
      .split(/[^\p{L}\p{M}\p{N}'’-]+/u)
      .map((word) => foldForMatching(word))
  );
  const fromContext = anchorTokens(plannedQuery).filter(
    (anchor) => !asked.has(foldForMatching(anchor))
  );
  return splitQuestionParts(question).map((part) =>
    [toKeywords(part), ...fromContext].join(' ').trim()
  );
};
