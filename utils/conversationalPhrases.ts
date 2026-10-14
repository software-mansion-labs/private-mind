import { CONVERSATIONAL_PHRASES } from '../constants/conversational-phrases';
import type { WelcomeLanguage } from '../constants/opening-greetings';
import { foldForMatching } from './queryTerms';

const ARABIC_VOWEL_MARKS = /[ً-ْـ]/g;
const APOSTROPHES = /['’]/g;
const NOT_A_LETTER_OR_SPACE = /[^\p{L}\p{M}\p{N}\s]/gu;
const STRETCHED_LETTER = /(\p{L})\1{2,}/gu;

export const normalizePhrase = (text: string): string =>
  foldForMatching(text.normalize('NFC'))
    .replace(ARABIC_VOWEL_MARKS, '')
    .replace(APOSTROPHES, '')
    .replace(NOT_A_LETTER_OR_SPACE, ' ')
    .replace(STRETCHED_LETTER, '$1')
    .replace(/\s+/g, ' ')
    .trim();

export const KNOWN_PHRASES: ReadonlySet<string> = new Set(
  CONVERSATIONAL_PHRASES.map(({ text }) => normalizePhrase(text))
);

export const greetingLanguages = (): ReadonlyMap<string, WelcomeLanguage> =>
  new Map(
    CONVERSATIONAL_PHRASES.flatMap((phrase): [string, WelcomeLanguage][] =>
      phrase.kind === 'greeting' && phrase.answeredIn
        ? [[normalizePhrase(phrase.text), phrase.answeredIn]]
        : []
    )
  );
