import {
  GREETING_ADDRESSEES,
  OPENING_WELCOMES,
  type WelcomeLanguage,
} from '../constants/opening-greetings';
import { greetingLanguages, normalizePhrase } from './conversationalPhrases';

const MAX_GREETING_CHARS = 48;

const wordCount = (phrase: string): number => phrase.split(' ').length;

const GREETING_LANGUAGE = greetingLanguages();

const ADDRESSEES = new Set(GREETING_ADDRESSEES.map(normalizePhrase));

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
  const normalized = normalizePhrase(message);
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
