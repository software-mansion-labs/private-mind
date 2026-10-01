import {
  GREETING_ADDRESSEES,
  OPENING_GREETINGS,
  OPENING_WELCOMES,
  type WelcomeLanguage,
} from '../constants/opening-greetings';

const MAX_GREETING_CHARS = 48;

const ARABIC_VOWEL_MARKS = /[ً-ْـ]/g;
const APOSTROPHES = /['’]/g;
const NOT_A_LETTER_OR_SPACE = /[^\p{L}\p{M}\p{N}\s]/gu;
const STRETCHED_LETTER = /(\p{L})\1{2,}/gu;

const normalizeGreeting = (text: string): string =>
  text
    .normalize('NFC')
    .toLowerCase()
    .replace(ARABIC_VOWEL_MARKS, '')
    .replace(APOSTROPHES, '')
    .replace(NOT_A_LETTER_OR_SPACE, ' ')
    .replace(STRETCHED_LETTER, '$1')
    .replace(/\s+/g, ' ')
    .trim();

const wordCount = (phrase: string): number => phrase.split(' ').length;

const GREETING_LANGUAGE = new Map<string, WelcomeLanguage>(
  OPENING_GREETINGS.flatMap(({ answeredIn, phrases }) =>
    phrases.map((phrase): [string, WelcomeLanguage] => [
      normalizeGreeting(phrase),
      answeredIn,
    ])
  )
);

const ADDRESSEES = new Set(GREETING_ADDRESSEES.map(normalizeGreeting));

const LONGEST_PHRASE_WORDS = Math.max(
  ...[...GREETING_LANGUAGE.keys(), ...ADDRESSEES].map(wordCount)
);

const longestPhraseAt = <T>(
  words: readonly string[],
  start: number,
  lookUp: (phrase: string) => T | undefined
): { found: T; length: number } | null => {
  const longest = Math.min(LONGEST_PHRASE_WORDS, words.length - start);
  for (let length = longest; length >= 1; length -= 1) {
    const found = lookUp(words.slice(start, start + length).join(' '));
    if (found !== undefined) return { found, length };
  }
  return null;
};

export const greetingLanguageOf = (message: string): WelcomeLanguage | null => {
  const normalized = normalizeGreeting(message);
  if (!normalized || normalized.length > MAX_GREETING_CHARS) return null;

  const words = normalized.split(' ');
  let language: WelcomeLanguage | null = null;
  let position = 0;

  while (position < words.length) {
    const greeting = longestPhraseAt(words, position, (phrase) =>
      GREETING_LANGUAGE.get(phrase)
    );
    if (greeting) {
      language ??= greeting.found;
      position += greeting.length;
      continue;
    }

    const addressee = language
      ? longestPhraseAt(words, position, (phrase) =>
          ADDRESSEES.has(phrase) ? true : undefined
        )
      : null;
    if (!addressee) return null;
    position += addressee.length;
  }

  return language;
};

export const isGreetingOnly = (message: string): boolean =>
  greetingLanguageOf(message) !== null;

export interface OpeningTurn {
  message: string;
  earlierRoles: readonly string[];
  hasAttachment: boolean;
  customInstructions: string;
}

const hasSpokenBefore = (roles: readonly string[]): boolean =>
  roles.some((role) => role === 'user' || role === 'assistant');

export const openingWelcomeFor = ({
  message,
  earlierRoles,
  hasAttachment,
  customInstructions,
}: OpeningTurn): string | null => {
  if (hasAttachment) return null;
  if (hasSpokenBefore(earlierRoles)) return null;
  if (customInstructions.trim()) return null;

  const language = greetingLanguageOf(message);
  return language ? OPENING_WELCOMES[language] : null;
};
