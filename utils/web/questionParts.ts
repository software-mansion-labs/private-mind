import { anchorTokens } from './anchorTokens';
import { foldForMatching } from '../queryTerms';
import { detectQuestionLanguage } from '../questionLanguage';
import {
  COORDINATION_LEXICONS,
  DEFAULT_COORDINATION_LANGUAGE,
  DEFAULT_LIST_COMMAS,
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

const FIXED_LISTS = new Set([
  'blood sweat tears',
  'crosby stills nash',
  'earth wind fire',
  'peter paul mary',
  'rock paper scissors',
  'snap crackle pop',
  'tom dick harry',
]);

const MAX_QUESTION_PARTS = 3;
const TWO_PARTS = 2;
const MIN_SHARED_CONTEXT_WORDS = 2;

interface Lexicon {
  conjunctions: Set<string>;
  questionWords: Set<string>;
  adpositions: Set<string>;
  functionWords: Set<string>;
  objectPronouns: Set<string>;
  questionWordLeadsClause: boolean;
  listCommas: Set<string>;
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
  listCommas: new Set(source.listCommas ?? DEFAULT_LIST_COMMAS),
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
  rights: string[][],
  lexicon: Lexicon
): string[] => {
  const subject = subjectOf(left, lexicon);
  if (subject.length === 0 || rights.some((right) => right.length < 2)) {
    return [];
  }
  return [
    join(left),
    ...rights.map((right) => join(askAboutSubject(right, subject, lexicon))),
  ];
};

interface ItemShape {
  shared: string[];
  first: string[];
  last: string[];
  tail: string[];
  fits: (item: string[]) => boolean;
}

const partsAround = (
  { shared, first, last, tail, fits }: ItemShape,
  middles: string[][]
): string[] => {
  if (shared.length + tail.length < MIN_SHARED_CONTEXT_WORDS) return [];
  if (!middles.every(fits)) return [];
  return [first, ...middles, last].map((item) => join(shared, item, tail));
};

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

const POSTPOSITION_PHRASE_WORDS = 2;

const repeatedAdpositionShape = (
  left: string[],
  right: string[],
  lexicon: Lexicon
): ItemShape | null => {
  const postposition = repeatsPostposition(left, right, lexicon);
  const length = postposition
    ? POSTPOSITION_PHRASE_WORDS
    : repeatedPrepositionLength(left, right, lexicon);
  if (length === 0) return null;
  const markerAt = postposition ? length - 1 : 0;
  const marker = bare(right[markerAt]!);
  return {
    shared: left.slice(0, -length),
    first: left.slice(-length),
    last: right.slice(0, length),
    tail: right.slice(length),
    fits: (item) => item.length === length && bare(item[markerAt]!) === marker,
  };
};

const isNameRun = (item: string[], lexicon: Lexicon): boolean =>
  item.every(
    (word) => isCapitalised(word) && !lexicon.functionWords.has(bare(word))
  );

const isContentWord = (item: string[], lexicon: Lexicon): boolean =>
  item.length === 1 && !lexicon.functionWords.has(bare(item[0]!));

const coordinatedParts = (
  left: string[],
  middles: string[][],
  right: string[],
  lexicon: Lexicon
): string[] => {
  const lastLeft = left.length - 1;

  const aroundAdposition = repeatedAdpositionShape(left, right, lexicon);
  if (aroundAdposition) return partsAround(aroundAdposition, middles);

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
    const first = left.slice(xStart);
    const last = right.slice(0, yEnd + 1);
    const sameLength = (item: string[]) =>
      item.length === first.length && item.length === last.length;
    return partsAround(
      {
        shared: left.slice(0, xStart),
        first,
        last,
        tail: right.slice(yEnd + 1),
        fits: (item) => sameLength(item) && isNameRun(item, lexicon),
      },
      middles
    );
  }

  const tail = right.slice(1);
  if (tail.length === 0) return [];
  return partsAround(
    {
      shared: left.slice(0, lastLeft),
      first: left.slice(lastLeft),
      last: right.slice(0, 1),
      tail,
      fits: (item) => isContentWord(item, lexicon),
    },
    middles
  );
};

interface Coordination {
  left: string[];
  conjunction: string;
  right: string[];
  lexicon: Lexicon;
}

const QUESTION_MARKS = /[?¿!؟;]+/g;

interface QuestionWords {
  words: string[];
  lexicon: Lexicon;
}

const wordsWithLexicon = (question: string): QuestionWords | null => {
  const language =
    detectQuestionLanguage(question)?.code ?? DEFAULT_COORDINATION_LANGUAGE;
  const lexicon = LEXICONS.get(language);
  if (!lexicon) return null;
  const words = question.replace(QUESTION_MARKS, ' ').trim().split(/\s+/);
  return { words, lexicon };
};

const isConjunctionAt = (
  { words, lexicon }: QuestionWords,
  index: number
): boolean =>
  index > 0 &&
  index < words.length - 1 &&
  lexicon.conjunctions.has(bare(words[index]!));

const coordinationsIn = (found: QuestionWords): Coordination[] =>
  found.words.flatMap((word, index) =>
    isConjunctionAt(found, index)
      ? [
          {
            left: found.words.slice(0, index),
            conjunction: word,
            right: found.words.slice(index + 1),
            lexicon: found.lexicon,
          },
        ]
      : []
  );

const findCoordination = (question: string): Coordination | null => {
  const found = wordsWithLexicon(question);
  return found ? (coordinationsIn(found)[0] ?? null) : null;
};

const endsWithListComma = (word: string, lexicon: Lexicon): boolean =>
  lexicon.listCommas.has(word.at(-1)!);

const withoutTrailingListComma = (item: string[], lexicon: Lexicon): string[] =>
  item.map((word, index) =>
    index === item.length - 1 && endsWithListComma(word, lexicon)
      ? word.slice(0, -1)
      : word
  );

interface ListBoundary {
  at: number;
  byComma: boolean;
}

interface ItemList {
  words: string[];
  boundaries: ListBoundary[];
  lexicon: Lexicon;
}

const lastIndexWhere = (
  from: number,
  matches: (index: number) => boolean
): number => {
  for (let index = from; index >= 0; index -= 1) {
    if (matches(index)) return index;
  }
  return -1;
};

const findItemList = (found: QuestionWords): ItemList | null => {
  const { words, lexicon } = found;
  const final = lastIndexWhere(words.length - 1, (index) =>
    isConjunctionAt(found, index)
  );
  if (final < 0) return null;
  if (words.slice(final + 1).some((word) => endsWithListComma(word, lexicon))) {
    return null;
  }
  const conjunction = bare(words[final]!);
  const oxfordCommaAt = final - 1;
  const boundaries = words.slice(0, oxfordCommaAt).flatMap((word, at) => {
    if (endsWithListComma(word, lexicon)) return [{ at, byComma: true }];
    if (at > 0 && bare(word) === conjunction) return [{ at, byComma: false }];
    return [];
  });
  if (boundaries.length === 0) return null;
  return {
    words,
    boundaries: [...boundaries, { at: final, byComma: false }],
    lexicon,
  };
};

const itemEndingAt = (
  { words, lexicon }: ItemList,
  from: number,
  boundary: ListBoundary
): string[] =>
  withoutTrailingListComma(
    words.slice(from, boundary.byComma ? boundary.at + 1 : boundary.at),
    lexicon
  );

const asksSomething = (words: string[], lexicon: Lexicon): boolean =>
  words.some((word) => lexicon.questionWords.has(bare(word)));

const opensClauses = (
  left: string[],
  rights: string[][],
  lexicon: Lexicon
): boolean =>
  lexicon.questionWordLeadsClause
    ? rights.every((right) => lexicon.questionWords.has(bare(right[0]!)))
    : asksSomething(left, lexicon) &&
      rights.every((right) => asksSomething(right, lexicon));

const matchableWords = (text: string): string =>
  foldForMatching(text)
    .split(/[^\p{L}\p{M}\p{N}'’]+/u)
    .filter(Boolean)
    .join(' ');

const coordinatedPhrase = ({ left, conjunction, right }: Coordination) =>
  matchableWords(`${left.at(-1)!} ${conjunction} ${right[0]!}`);

const joinsFixedPair = (coordination: Coordination): boolean =>
  FIXED_PAIRS.has(coordinatedPhrase(coordination));

const namesFixedList = ({ words, lexicon }: QuestionWords): boolean => {
  const listed = ` ${matchableWords(
    words.filter((word) => !lexicon.conjunctions.has(bare(word))).join(' ')
  )} `;
  return [...FIXED_LISTS].some((name) => listed.includes(` ${name} `));
};

const namesOneThing = (found: QuestionWords): boolean =>
  coordinationsIn(found).some(joinsFixedPair) || namesFixedList(found);

const distinctParts = (parts: string[], count: number): string[] => {
  const distinct = [...new Set(parts.filter(Boolean))];
  return distinct.length === count ? distinct : [];
};

const partsOfList = (list: ItemList, middleCount: number): string[] => {
  const { words, boundaries, lexicon } = list;
  const listStart = boundaries.length - 1 - middleCount;
  const first = itemEndingAt(list, 0, boundaries[listStart]!);
  const middles = boundaries
    .slice(listStart + 1)
    .map((boundary, index) =>
      itemEndingAt(list, boundaries[listStart + index]!.at + 1, boundary)
    );
  const last = words.slice(boundaries.at(-1)!.at + 1);
  if ([first, ...middles].some((item) => item.length === 0)) return [];
  const rights = [...middles, last];
  const listsClauses =
    asksSomething(first, lexicon) && opensClauses(first, rights, lexicon);
  const parts = listsClauses
    ? clauseParts(first, rights, lexicon)
    : coordinatedParts(first, middles, last, lexicon);
  return distinctParts(parts, rights.length + 1);
};

const listParts = (found: QuestionWords): string[] | null => {
  const list = findItemList(found);
  if (!list) return null;
  for (
    let middleCount = list.boundaries.length - 1;
    middleCount >= 1;
    middleCount -= 1
  ) {
    const parts = partsOfList(list, middleCount);
    if (parts.length > MAX_QUESTION_PARTS) return [];
    if (parts.length > 0) return parts;
  }
  return null;
};

const twoParts = (found: QuestionWords): string[] => {
  const coordination = coordinationsIn(found)[0];
  if (!coordination) return [];
  const { left, right, lexicon } = coordination;
  const parts = opensClauses(left, [right], lexicon)
    ? clauseParts(left, [right], lexicon)
    : coordinatedParts(left, [], right, lexicon);
  return distinctParts(parts, TWO_PARTS);
};

export const splitQuestionParts = (question: string): string[] => {
  const found = wordsWithLexicon(question);
  if (!found || namesOneThing(found)) return [];
  return listParts(found) ?? twoParts(found);
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
