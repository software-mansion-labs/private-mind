import type {
  ReverbDefaultVoiceName,
  ReverbLanguage,
} from 'react-native-executorch';
import {
  LANGUAGE_SAMPLE_CHARACTERS,
  MAX_STRAY_SCRIPT_SHARE,
  MIN_SPOKEN_CHARACTERS,
  READ_ALOUD_VOICES,
} from '../constants/read-aloud';
import type { Message } from '../database/chatRepository';
import { detectQuestionLanguage } from './questionLanguage';
import { cleanForSpeech } from './speechText';

export interface ReadAloudPlan {
  text: string;
  language: ReverbLanguage;
  voice: ReverbDefaultVoiceName;
}

export const isReadAloudLanguage = (code: string): code is ReverbLanguage =>
  Object.prototype.hasOwnProperty.call(READ_ALOUD_VOICES, code);

const LETTER = /\p{L}/u;
const LAST_LATIN_EXTENDED_B = 0x024f;
const LATIN_EXTENDED_ADDITIONAL_START = 0x1e00;
const LATIN_EXTENDED_ADDITIONAL_END = 0x1eff;

const isLatinLetter = (char: string): boolean => {
  const code = char.codePointAt(0) ?? 0;
  return (
    code <= LAST_LATIN_EXTENDED_B ||
    (code >= LATIN_EXTENDED_ADDITIONAL_START &&
      code <= LATIN_EXTENDED_ADDITIONAL_END)
  );
};

const isStrayScriptLetter = (char: string): boolean =>
  LETTER.test(char) && !isLatinLetter(char);

const withoutStrayScripts = (text: string): string | null => {
  let letters = 0;
  let stray = 0;
  let kept = '';
  for (const char of text) {
    if (LETTER.test(char)) letters += 1;
    if (isStrayScriptLetter(char)) {
      stray += 1;
      continue;
    }
    kept += char;
  }
  if (stray > letters * MAX_STRAY_SCRIPT_SHARE) return null;
  return kept;
};

export const readAloudPlanFor = (
  message: Pick<Message, 'role' | 'content'>
): ReadAloudPlan | null => {
  if (message.role !== 'assistant') return null;

  const text = withoutStrayScripts(cleanForSpeech(message.content));
  if (text === null || text.length < MIN_SPOKEN_CHARACTERS) return null;

  const detected = detectQuestionLanguage(
    text.slice(0, LANGUAGE_SAMPLE_CHARACTERS)
  );
  if (!detected || !isReadAloudLanguage(detected.code)) return null;

  return {
    text,
    language: detected.code,
    voice: READ_ALOUD_VOICES[detected.code],
  };
};
