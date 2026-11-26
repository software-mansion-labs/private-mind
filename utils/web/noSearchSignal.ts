import { foldForMatching } from '../queryTerms';
import { COORDINATION_LEXICONS } from './coordinationLexicon';
import {
  MIXED_IN_LANGUAGE,
  NO_SEARCH_LEXICONS,
  LOOKALIKE_LANGUAGES,
  type NoSearchLexicon,
  type RequestVerbPosition,
} from './noSearchLexicon';
import { RECAP_LEXICONS } from './recapLexicon';

type Phrase = string[];

interface Cue {
  phrase: Phrase;
  stem: boolean;
}

interface Lexicon {
  politeWords: Phrase[];
  taskVerbs: Phrase[];
  makeVerbs: Phrase[];
  writtenWorks: Set<string>;
  opinionOpeners: Phrase[];
  opinionPhrases: Phrase[];
  howWords: Set<string>;
  questionWords: Set<string>;
  arithmeticWords: RegExp | null;
  lookupCues: Cue[];
  lookupVerbCues: Cue[];
  requestVerbPosition: RequestVerbPosition;
  summaryCues: Cue[];
  conversationReferents: Cue[];
  recapFillers: Phrase[];
}

interface Clause {
  words: string[];
  ledByPoliteness: boolean;
}

const WRITTEN_WORK_REACH = 4;

const STEM_MARK = '*';

const LETTER_VARIANTS = new Map([
  ['\u064A', '\u06CC'],
  ['\u0649', '\u06CC'],
  ['\u0643', '\u06A9'],
  ['\u06C1', '\u0647'],
  ['\u0131', 'i'],
  ['\u02BC', "'"],
  ['\u2019', "'"],
  ['\u0901', '\u0902'],
]);

const LETTER_VARIANT_PATTERN = new RegExp(
  [...LETTER_VARIANTS.keys()].join('|'),
  'gu'
);

const IGNORED_MARKS =
  /\u0640|[\u064B-\u065F]|\u0670|\u093C|\u09BC|\u200C|\u200D/gu;

const CLAUSE_BREAK = /[!?;¿¡؟،؛।۔\n]+|[.:,](?=\s|$)/u;

const EDGE_PUNCTUATION = /^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu;

const ARITHMETIC_SYMBOLS = /\p{N}\s*(?:[+*/×÷^=]|\s-\s)\s*\p{N}/u;

const CODE = /```|`[^`\n]+`|\bdef\s+\w+\(|=>|\bfunction\s*\w*\(/u;

const normalise = (text: string): string =>
  foldForMatching(text)
    .replace(IGNORED_MARKS, '')
    .replace(
      LETTER_VARIANT_PATTERN,
      (char) => LETTER_VARIANTS.get(char) ?? char
    );

const wordsOf = (normalised: string): string[] =>
  normalised
    .split(/\s+/)
    .map((word) => word.replace(EDGE_PUNCTUATION, ''))
    .filter(Boolean);

const phrasesOf = (entries: string[]): Phrase[] =>
  entries
    .map((entry) => wordsOf(normalise(entry)))
    .filter((phrase) => phrase.length > 0)
    .sort((a, b) => b.length - a.length);

const cuesOf = (entries: string[]): Cue[] =>
  entries
    .map((entry) => ({
      phrase: wordsOf(normalise(entry)),
      stem: entry.endsWith(STEM_MARK),
    }))
    .filter(({ phrase }) => phrase.length > 0);

const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const arithmeticWordsPattern = (words: string[]): RegExp | null => {
  if (words.length === 0) return null;
  const alternatives = phrasesOf(words)
    .map((phrase) => phrase.map(escapeRegExp).join('\\s+'))
    .join('|');
  return new RegExp(`\\p{N}\\s+(?:${alternatives})\\s+\\p{N}`, 'u');
};

const toLexicon = (code: string, source: NoSearchLexicon): Lexicon => {
  const recap = RECAP_LEXICONS[code];
  return {
    politeWords: phrasesOf(source.politeWords),
    taskVerbs: phrasesOf(source.taskVerbs),
    makeVerbs: phrasesOf(source.makeVerbs),
    writtenWorks: new Set(source.writtenWorks.map(normalise)),
    opinionOpeners: phrasesOf(source.opinionOpeners),
    opinionPhrases: phrasesOf(source.opinionPhrases),
    howWords: new Set(source.howWords.map(normalise)),
    questionWords: new Set(
      (COORDINATION_LEXICONS[code]?.questionWords ?? []).map(normalise)
    ),
    arithmeticWords: arithmeticWordsPattern(source.arithmeticWords),
    lookupCues: cuesOf([...source.freshnessWords, ...source.lookupVerbs]),
    lookupVerbCues: cuesOf(source.lookupVerbs),
    requestVerbPosition: source.requestVerbPosition,
    summaryCues: cuesOf(recap?.summaryVerbs ?? []),
    conversationReferents: cuesOf(recap?.conversationReferents ?? []),
    recapFillers: phrasesOf([
      ...source.politeWords,
      ...source.taskVerbs,
      ...source.makeVerbs,
      ...(recap?.recapObjects ?? []),
    ]),
  };
};

const LEXICONS = new Map(
  Object.entries(NO_SEARCH_LEXICONS).map(([code, source]) => [
    code,
    toLexicon(code, source),
  ])
);

const startsWith = (words: string[], phrase: Phrase): boolean =>
  phrase.length <= words.length &&
  phrase.every((word, index) => words[index] === word);

const endsWith = (words: string[], phrase: Phrase): boolean => {
  const offset = words.length - phrase.length;
  return (
    offset >= 0 && phrase.every((word, index) => words[offset + index] === word)
  );
};

const containsPhrase = (words: string[], phrase: Phrase): boolean =>
  words.some((_, start) => startsWith(words.slice(start), phrase));

const ELISION = "'";

const withoutElidedArticle = (word: string): string =>
  word.slice(word.indexOf(ELISION) + 1);

const matchesCueWord = (
  word: string,
  cueWord: string,
  stemmed: boolean
): boolean =>
  [word, withoutElidedArticle(word)].some((form) =>
    stemmed ? form.startsWith(cueWord) : form === cueWord
  );

const cueAt = (words: string[], start: number, cue: Cue): boolean =>
  cue.phrase.every((cueWord, index) => {
    const word = words[start + index];
    const stemmed = cue.stem && index === cue.phrase.length - 1;
    return word !== undefined && matchesCueWord(word, cueWord, stemmed);
  });

const containsCue = (words: string[], cue: Cue): boolean =>
  words.some((_, start) => cueAt(words, start, cue));

const withoutLeading = (words: string[], phrases: Phrase[]): string[] => {
  let rest = words;
  let found = phrases.find((phrase) => startsWith(rest, phrase));
  while (found) {
    rest = rest.slice(found.length);
    found = phrases.find((phrase) => startsWith(rest, phrase));
  }
  return rest;
};

const withoutTrailing = (words: string[], phrases: Phrase[]): string[] => {
  let rest = words;
  let found = phrases.find((phrase) => endsWith(rest, phrase));
  while (found) {
    rest = rest.slice(0, rest.length - found.length);
    found = phrases.find((phrase) => endsWith(rest, phrase));
  }
  return rest;
};

const clauseOf = (words: string[], lexicon: Lexicon): Clause => {
  const opened = withoutLeading(words, lexicon.politeWords);
  return {
    words: withoutTrailing(opened, lexicon.politeWords),
    ledByPoliteness: opened.length < words.length,
  };
};

const readsRequestAtStart = (lexicon: Lexicon): boolean =>
  lexicon.requestVerbPosition !== 'end';

const readsRequestAtEnd = (clause: Clause, lexicon: Lexicon): boolean =>
  (lexicon.requestVerbPosition !== 'start' || clause.ledByPoliteness) &&
  !clause.words.some((word) => lexicon.howWords.has(word));

const wordsAfterRequest = (
  clause: Clause,
  phrases: Phrase[],
  lexicon: Lexicon
): string[] | null => {
  const { words } = clause;
  if (readsRequestAtStart(lexicon)) {
    const opening = phrases.find((phrase) => startsWith(words, phrase));
    if (opening) return words.slice(opening.length);
  }
  if (readsRequestAtEnd(clause, lexicon)) {
    const closing = phrases.find((phrase) => endsWith(words, phrase));
    if (closing) return words.slice(0, words.length - closing.length).reverse();
  }
  return null;
};

const namesWrittenWorkNearby = (
  nearestFirst: string[],
  lexicon: Lexicon
): boolean => {
  for (const word of nearestFirst.slice(0, WRITTEN_WORK_REACH)) {
    if (lexicon.writtenWorks.has(word)) return true;
    if (lexicon.questionWords.has(word)) return false;
  }
  return false;
};

const asksForWriting = (clause: Clause, lexicon: Lexicon): boolean => {
  if (wordsAfterRequest(clause, lexicon.taskVerbs, lexicon)) return true;
  const afterMakeVerb = wordsAfterRequest(clause, lexicon.makeVerbs, lexicon);
  return !!afterMakeVerb && namesWrittenWorkNearby(afterMakeVerb, lexicon);
};

const asksForOpinion = (clause: Clause, lexicon: Lexicon): boolean =>
  lexicon.opinionOpeners.some((phrase) => startsWith(clause.words, phrase));

const asksForNoSearch = (normalised: string, lexicon: Lexicon): boolean => {
  const clauses = normalised
    .split(CLAUSE_BREAK)
    .map((text) => clauseOf(wordsOf(text), lexicon));
  const allWords = wordsOf(normalised);
  return (
    clauses.some(
      (clause) =>
        asksForWriting(clause, lexicon) || asksForOpinion(clause, lexicon)
    ) ||
    lexicon.opinionPhrases.some((phrase) => containsPhrase(allWords, phrase)) ||
    !!lexicon.arithmeticWords?.test(normalised)
  );
};

const lookalikesOf = (language: string): string[] =>
  LOOKALIKE_LANGUAGES.find((group) => group.includes(language)) ?? [];

const lexiconsFor = (language: string): Lexicon[] =>
  [...new Set([language, ...lookalikesOf(language), MIXED_IN_LANGUAGE])]
    .map((code) => LEXICONS.get(code))
    .filter((lexicon): lexicon is Lexicon => !!lexicon);

export const hasNoSearchLexicon = (language: string): boolean =>
  LEXICONS.has(language);

export const lacksSearchSignal = (query: string, language: string): boolean => {
  if (CODE.test(query) || ARITHMETIC_SYMBOLS.test(query)) return true;
  const normalised = normalise(query);
  return lexiconsFor(language).some((lexicon) =>
    asksForNoSearch(normalised, lexicon)
  );
};

export const namesFreshnessOrLookup = (
  query: string,
  language: string
): boolean => {
  const words = wordsOf(normalise(query));
  return lexiconsFor(language).some((lexicon) =>
    lexicon.lookupCues.some((cue) => containsCue(words, cue))
  );
};

const summaryCueAt = (
  words: string[],
  start: number,
  lexicon: Lexicon
): Cue | undefined =>
  lexicon.summaryCues.find((cue) => cueAt(words, start, cue));

const summarisesWithoutObject = (
  words: string[],
  lexicon: Lexicon
): boolean => {
  let start = 0;
  let summarised = false;
  while (start < words.length) {
    const cue = summaryCueAt(words, start, lexicon);
    if (cue) {
      summarised = true;
      start += cue.phrase.length;
      continue;
    }
    const rest = words.slice(start);
    const filler = lexicon.recapFillers.find((phrase) =>
      startsWith(rest, phrase)
    );
    if (!filler) return false;
    start += filler.length;
  }
  return summarised;
};

const namesTheConversation = (words: string[], lexicon: Lexicon): boolean =>
  lexicon.conversationReferents.some((cue) => containsCue(words, cue));

const namesASummary = (words: string[], lexicon: Lexicon): boolean =>
  lexicon.summaryCues.some((cue) => containsCue(words, cue));

const namesALookupVerb = (words: string[], lexicon: Lexicon): boolean =>
  lexicon.lookupVerbCues.some((cue) => containsCue(words, cue));

const asksForRecap = (words: string[], lexicon: Lexicon): boolean => {
  if (summarisesWithoutObject(words, lexicon)) return true;
  if (!namesTheConversation(words, lexicon)) return false;
  return namesASummary(words, lexicon) || !namesALookupVerb(words, lexicon);
};

export const asksForConversationRecap = (query: string): boolean => {
  const words = wordsOf(normalise(query));
  return [...LEXICONS.values()].some((lexicon) => asksForRecap(words, lexicon));
};
