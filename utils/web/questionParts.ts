import { anchorTokens } from './anchorTokens';
import { foldForMatching } from '../queryTerms';
import { detectQuestionLanguage } from '../questionLanguage';

const CONJUNCTIONS = new Set([
  'and',
  'or',
  'oraz',
  'lub',
  'und',
  'oder',
  'et',
  'ou',
  'y',
  'e',
]);

const QUESTION_WORDS = new Set([
  'who',
  'what',
  'when',
  'where',
  'which',
  'how',
  'kto',
  'co',
  'kiedy',
  'gdzie',
  'który',
  'która',
  'które',
  'jaki',
  'jaka',
  'jakie',
  'ile',
  'wer',
  'wann',
  'wo',
  'welche',
  'welcher',
  'quién',
  'qué',
  'cuándo',
  'dónde',
  'cuál',
  'qui',
  'que',
  'quand',
  'où',
  'quel',
  'quelle',
]);

const PREPOSITIONS = new Set([
  'in',
  'for',
  'at',
  'on',
  'of',
  'by',
  'w',
  'we',
  'na',
  'dla',
  'für',
  'bei',
  'auf',
  'en',
  'para',
  'de',
  'pour',
  'à',
]);

const FUNCTION_WORDS = new Set([
  ...PREPOSITIONS,
  ...QUESTION_WORDS,
  'the',
  'a',
  'an',
  'my',
  'your',
  'his',
  'her',
  'its',
  'our',
  'their',
  'with',
  'to',
  'is',
  'are',
  'was',
  'did',
  'does',
  'do',
  'z',
  'o',
  'mit',
  'con',
  'avec',
]);

const CONJUNCTIONS_BY_LANGUAGE: Record<string, Set<string>> = {
  pl: new Set(['i']),
};

const QUESTION_WORDS_BY_LANGUAGE: Record<string, Set<string>> = {
  de: new Set(['was']),
};

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

const OBJECT_PRONOUNS = new Set(['it', 'them', 'this', 'that', 'him', 'her']);

const MAX_QUESTION_PARTS = 2;

const bare = (word: string): string =>
  word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'’]+$/gu, '');

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

const skipFunctionWords = (words: string[], from: number): number => {
  let at = from;
  while (at < words.length && FUNCTION_WORDS.has(bare(words[at]!))) at += 1;
  return at;
};

const stripTrailingPunctuation = (words: string[]): string[] =>
  words.map((word, index) =>
    index === words.length - 1 ? word.replace(/[,;:]+$/, '') : word
  );

const stripLeadingQuestionPhrase = (words: string[]): string[] => {
  let start = skipFunctionWords(words, 0);
  if (start > 0 && start < words.length && !isCapitalised(words[start]!)) {
    start = skipFunctionWords(words, start + 1);
  }
  return stripTrailingPunctuation(words.slice(start));
};

const askAboutSubject = (clause: string[], subject: string[]): string[] => {
  const pronounAt = clause.findIndex(
    (word, index) => index > 0 && OBJECT_PRONOUNS.has(bare(word))
  );
  if (pronounAt < 0) return [...clause, ...subject];
  return [
    ...clause.slice(0, pronounAt),
    ...subject,
    ...clause.slice(pronounAt + 1),
  ];
};

const clauseParts = (left: string[], right: string[]): string[] => {
  const subject = stripLeadingQuestionPhrase(left);
  if (subject.length === 0 || right.length < 2) return [];
  return [join(left), join(askAboutSubject(right, subject))];
};

const coordinatedParts = (left: string[], right: string[]): string[] => {
  const lastLeft = left.length - 1;
  const firstRight = bare(right[0]!);

  if (
    PREPOSITIONS.has(firstRight) &&
    left.length >= 2 &&
    bare(left[lastLeft - 1]!) === firstRight &&
    right.length >= 2
  ) {
    const shared = left.slice(0, lastLeft - 1);
    const x = left.slice(lastLeft - 1);
    const y = right.slice(0, 2);
    const tail = right.slice(2);
    return [join(shared, x, tail), join(shared, y, tail)];
  }

  if (
    FUNCTION_WORDS.has(firstRight) ||
    FUNCTION_WORDS.has(bare(left[lastLeft]!))
  ) {
    return [];
  }

  if (isCapitalised(right[0]!) && isCapitalised(left[lastLeft]!)) {
    const xStart = capitalisedRunEndingAt(left, lastLeft);
    const yEnd = capitalisedRunStartingAt(right, 0);
    const bothSingleWords = xStart === lastLeft && yEnd === 0;
    const afterPreposition =
      xStart > 0 && PREPOSITIONS.has(bare(left[xStart - 1]!));
    if (bothSingleWords && !afterPreposition) return [];
    const shared = left.slice(0, xStart);
    const x = left.slice(xStart);
    const y = right.slice(0, yEnd + 1);
    const tail = right.slice(yEnd + 1);
    return [join(shared, x, tail), join(shared, y, tail)];
  }

  const shared = left.slice(0, lastLeft);
  const x = left.slice(lastLeft);
  const y = right.slice(0, 1);
  const tail = right.slice(1);
  if (shared.length === 0 || tail.length === 0) return [];
  return [join(shared, x, tail), join(shared, y, tail)];
};

interface Coordination {
  left: string[];
  conjunction: string;
  right: string[];
  questionWords: Set<string>;
}

const findCoordination = (question: string): Coordination | null => {
  const words = question
    .replace(/[?¿!]+/g, ' ')
    .trim()
    .split(/\s+/);
  const language = detectQuestionLanguage(question)?.code ?? '';
  const languageConjunctions = CONJUNCTIONS_BY_LANGUAGE[language];
  const isConjunction = (word: string) =>
    CONJUNCTIONS.has(word) || (languageConjunctions?.has(word) ?? false);
  const at = words.findIndex((word, index) => index > 0 && isConjunction(word));
  if (at <= 0 || at >= words.length - 1) return null;
  return {
    left: words.slice(0, at),
    conjunction: words[at]!,
    right: words.slice(at + 1),
    questionWords: new Set([
      ...QUESTION_WORDS,
      ...(QUESTION_WORDS_BY_LANGUAGE[language] ?? []),
    ]),
  };
};

const matchableWords = (text: string): string =>
  foldForMatching(text)
    .split(/[^\p{L}\p{N}'’]+/u)
    .filter(Boolean)
    .join(' ');

const coordinatedPhrase = ({ left, conjunction, right }: Coordination) =>
  matchableWords(`${left.at(-1)!} ${conjunction} ${right[0]!}`);

const namesOneThing = (coordination: Coordination): boolean =>
  FIXED_PAIRS.has(coordinatedPhrase(coordination));

export const splitQuestionParts = (question: string): string[] => {
  const coordination = findCoordination(question);
  if (!coordination || namesOneThing(coordination)) return [];
  const { left, right, questionWords } = coordination;
  const parts = questionWords.has(bare(right[0]!))
    ? clauseParts(left, right)
    : coordinatedParts(left, right);
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
    question.split(/[^\p{L}\p{N}'’-]+/u).map((word) => foldForMatching(word))
  );
  const fromContext = anchorTokens(plannedQuery).filter(
    (anchor) => !asked.has(foldForMatching(anchor))
  );
  return splitQuestionParts(question).map((part) =>
    [toKeywords(part), ...fromContext].join(' ').trim()
  );
};
