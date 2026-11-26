import type { WhisperLanguage } from 'react-native-executorch';

export const WHISPER_LANGUAGE_NAMES: Record<WhisperLanguage, string> = {
  en: 'English',
  zh: 'Chinese',
  de: 'German',
  es: 'Spanish',
  ru: 'Russian',
  ko: 'Korean',
  fr: 'French',
  ja: 'Japanese',
  pt: 'Portuguese',
  tr: 'Turkish',
  pl: 'Polish',
  ca: 'Catalan',
  nl: 'Dutch',
  ar: 'Arabic',
  sv: 'Swedish',
  it: 'Italian',
  id: 'Indonesian',
  hi: 'Hindi',
  fi: 'Finnish',
  vi: 'Vietnamese',
  he: 'Hebrew',
  uk: 'Ukrainian',
  el: 'Greek',
  ms: 'Malay',
  cs: 'Czech',
  ro: 'Romanian',
  da: 'Danish',
  hu: 'Hungarian',
  ta: 'Tamil',
  no: 'Norwegian',
  th: 'Thai',
  ur: 'Urdu',
  hr: 'Croatian',
  bg: 'Bulgarian',
  lt: 'Lithuanian',
  la: 'Latin',
  mi: 'Maori',
  ml: 'Malayalam',
  cy: 'Welsh',
  sk: 'Slovak',
  te: 'Telugu',
  fa: 'Persian',
  lv: 'Latvian',
  bn: 'Bengali',
  sr: 'Serbian',
  az: 'Azerbaijani',
  sl: 'Slovenian',
  kn: 'Kannada',
  et: 'Estonian',
  mk: 'Macedonian',
  br: 'Breton',
  eu: 'Basque',
  is: 'Icelandic',
  hy: 'Armenian',
  ne: 'Nepali',
  mn: 'Mongolian',
  bs: 'Bosnian',
  kk: 'Kazakh',
  sq: 'Albanian',
  sw: 'Swahili',
  gl: 'Galician',
  mr: 'Marathi',
  pa: 'Punjabi',
  si: 'Sinhala',
  km: 'Khmer',
  sn: 'Shona',
  yo: 'Yoruba',
  so: 'Somali',
  af: 'Afrikaans',
  oc: 'Occitan',
  ka: 'Georgian',
  be: 'Belarusian',
  tg: 'Tajik',
  sd: 'Sindhi',
  gu: 'Gujarati',
  am: 'Amharic',
  yi: 'Yiddish',
  lo: 'Lao',
  uz: 'Uzbek',
  fo: 'Faroese',
  ht: 'Haitian Creole',
  ps: 'Pashto',
  tk: 'Turkmen',
  nn: 'Norwegian Nynorsk',
  mt: 'Maltese',
  sa: 'Sanskrit',
  lb: 'Luxembourgish',
  my: 'Burmese',
  bo: 'Tibetan',
  tl: 'Tagalog',
  mg: 'Malagasy',
  as: 'Assamese',
  tt: 'Tatar',
  haw: 'Hawaiian',
  ln: 'Lingala',
  ha: 'Hausa',
  ba: 'Bashkir',
  jw: 'Javanese',
  su: 'Sundanese',
  yue: 'Cantonese',
};

export const DICTATION_LANGUAGES_BY_USER_SHARE: readonly WhisperLanguage[] = [
  'en',
  'hi',
  'ur',
  'de',
  'pl',
  'es',
  'fr',
  'pt',
  'ar',
  'fa',
  'id',
  'tr',
  'ru',
  'it',
];

export const ENGLISH_DICTATION_LANGUAGE: WhisperLanguage = 'en';

export interface DictationLanguageOption {
  code: WhisperLanguage;
  name: string;
}

const byName = (a: DictationLanguageOption, b: DictationLanguageOption) =>
  a.name.localeCompare(b.name);

const optionOf = (code: WhisperLanguage): DictationLanguageOption => ({
  code,
  name: WHISPER_LANGUAGE_NAMES[code],
});

export const DICTATION_LANGUAGES: readonly DictationLanguageOption[] = [
  ...DICTATION_LANGUAGES_BY_USER_SHARE.map(optionOf),
  ...(Object.keys(WHISPER_LANGUAGE_NAMES) as WhisperLanguage[])
    .filter((code) => !DICTATION_LANGUAGES_BY_USER_SHARE.includes(code))
    .map(optionOf)
    .sort(byName),
];

export const isWhisperLanguage = (code: string): code is WhisperLanguage =>
  Object.prototype.hasOwnProperty.call(WHISPER_LANGUAGE_NAMES, code);

export const dictationLanguageName = (code: WhisperLanguage): string =>
  WHISPER_LANGUAGE_NAMES[code];

export const DICTATION_LANGUAGE_LABEL = 'Dictation language';

export const filterDictationLanguages = (
  query: string
): readonly DictationLanguageOption[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return DICTATION_LANGUAGES;
  return DICTATION_LANGUAGES.filter(
    ({ code, name }) => code === needle || name.toLowerCase().includes(needle)
  );
};
