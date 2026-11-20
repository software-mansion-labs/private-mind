import { getLocales } from 'expo-localization';
import { languageOfCode, type QuestionLanguage } from './questionLanguage';

export const deviceLanguage = (): QuestionLanguage | null =>
  languageOfCode(getLocales()[0]?.languageCode);
