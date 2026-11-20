import type {
  ReverbDefaultVoiceName,
  ReverbLanguage,
} from 'react-native-executorch';
import {
  LANGUAGE_SAMPLE_CHARACTERS,
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

export const readAloudPlanFor = (
  message: Pick<Message, 'role' | 'content'>
): ReadAloudPlan | null => {
  if (message.role !== 'assistant') return null;

  const text = cleanForSpeech(message.content);
  if (text.length < MIN_SPOKEN_CHARACTERS) return null;

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
