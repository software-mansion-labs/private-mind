import { getLocales, type Locale } from 'expo-localization';
import type { WhisperLanguage } from 'react-native-executorch';
import {
  ENGLISH_DICTATION_LANGUAGE,
  dictationLanguageName,
  isWhisperLanguage,
} from '../constants/dictation-languages';

export const PHONE_LANGUAGE = 'phone';

export type DictationLanguagePreference =
  typeof PHONE_LANGUAGE | WhisperLanguage;

export type SttModelKind = 'english' | 'multilingual';

export const DEFAULT_DICTATION_LANGUAGE: DictationLanguagePreference =
  PHONE_LANGUAGE;

const LOCALE_CODES_WHISPER_SPELLS_DIFFERENTLY: Record<string, WhisperLanguage> =
  {
    nb: 'no',
    iw: 'he',
    in: 'id',
    ji: 'yi',
    jv: 'jw',
    fil: 'tl',
  };

type LocaleLanguage = Pick<Locale, 'languageCode'>;

export const whisperLanguageOfLocaleCode = (
  code: string | null | undefined
): WhisperLanguage | null => {
  if (!code) return null;
  const lower = code.toLowerCase();
  const renamed = LOCALE_CODES_WHISPER_SPELLS_DIFFERENTLY[lower];
  if (renamed) return renamed;
  return isWhisperLanguage(lower) ? lower : null;
};

export const whisperLanguageOfLocales = (
  locales: readonly LocaleLanguage[]
): WhisperLanguage => {
  for (const locale of locales) {
    const language = whisperLanguageOfLocaleCode(locale.languageCode);
    if (language) return language;
  }
  return ENGLISH_DICTATION_LANGUAGE;
};

export const phoneDictationLanguage = (): WhisperLanguage => {
  try {
    return whisperLanguageOfLocales(getLocales());
  } catch {
    return ENGLISH_DICTATION_LANGUAGE;
  }
};

export const sanitizeDictationLanguage = (
  value: unknown
): DictationLanguagePreference =>
  value === PHONE_LANGUAGE ||
  (typeof value === 'string' && isWhisperLanguage(value))
    ? (value as DictationLanguagePreference)
    : DEFAULT_DICTATION_LANGUAGE;

export const resolveDictationLanguage = (
  preference: DictationLanguagePreference,
  phoneLanguage: () => WhisperLanguage = phoneDictationLanguage
): WhisperLanguage =>
  preference === PHONE_LANGUAGE ? phoneLanguage() : preference;

export const sttModelKindFor = (language: WhisperLanguage): SttModelKind =>
  language === ENGLISH_DICTATION_LANGUAGE ? 'english' : 'multilingual';

export const dictationPreferenceLabel = (
  preference: DictationLanguagePreference,
  phoneLanguage: () => WhisperLanguage = phoneDictationLanguage
): string =>
  dictationLanguageName(resolveDictationLanguage(preference, phoneLanguage));
