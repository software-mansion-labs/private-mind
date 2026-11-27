import { getLocales } from 'expo-localization';
import {
  DICTATION_LANGUAGES,
  DICTATION_LANGUAGES_BY_USER_SHARE,
  filterDictationLanguages,
} from '../constants/dictation-languages';
import {
  PHONE_LANGUAGE,
  dictationPreferenceLabel,
  phoneDictationLanguage,
  resolveDictationLanguage,
  sanitizeDictationLanguage,
  sttModelKindFor,
  whisperLanguageOfLocaleCode,
  whisperLanguageOfLocales,
} from '../utils/dictationLanguage';

const mockGetLocales = getLocales as jest.Mock;

const locales = (...codes: (string | null)[]) =>
  codes.map((languageCode) => ({ languageCode }));

describe('mapping the phone locale to a Whisper language', () => {
  it.each([
    ['pl', 'pl'],
    ['de', 'de'],
    ['hi', 'hi'],
    ['ur', 'ur'],
    ['EN', 'en'],
    ['nb', 'no'],
    ['iw', 'he'],
    ['in', 'id'],
    ['fil', 'tl'],
    ['jv', 'jw'],
  ])('reads %s as %s', (code, expected) => {
    expect(whisperLanguageOfLocaleCode(code)).toBe(expected);
  });

  it('knows no Whisper language for a locale Whisper was not trained on', () => {
    expect(whisperLanguageOfLocaleCode('ga')).toBeNull();
    expect(whisperLanguageOfLocaleCode(null)).toBeNull();
  });

  it('takes the first preferred language Whisper can transcribe', () => {
    expect(whisperLanguageOfLocales(locales('ga', 'pl', 'en'))).toBe('pl');
  });

  it('falls back to English when no preferred language is supported', () => {
    expect(whisperLanguageOfLocales(locales('ga', null))).toBe('en');
    expect(whisperLanguageOfLocales([])).toBe('en');
  });

  it('reads the phone locales', () => {
    mockGetLocales.mockReturnValueOnce(locales('pl'));
    expect(phoneDictationLanguage()).toBe('pl');
  });

  it('dictates in English when the locale cannot be read', () => {
    mockGetLocales.mockImplementationOnce(() => {
      throw new Error('no locales');
    });
    expect(phoneDictationLanguage()).toBe('en');
  });
});

describe('the dictation language preference', () => {
  const polishPhone = () => 'pl' as const;

  it('follows the phone language until the user picks one', () => {
    expect(resolveDictationLanguage(PHONE_LANGUAGE, polishPhone)).toBe('pl');
  });

  it('uses the picked language over the phone language', () => {
    expect(resolveDictationLanguage('de', polishPhone)).toBe('de');
    expect(resolveDictationLanguage('en', polishPhone)).toBe('en');
  });

  it('names the language dictation will use', () => {
    expect(dictationPreferenceLabel(PHONE_LANGUAGE, polishPhone)).toBe(
      'Polish'
    );
    expect(dictationPreferenceLabel('hi', polishPhone)).toBe('Hindi');
  });

  it('drops a stored value that is no longer a language', () => {
    expect(sanitizeDictationLanguage('klingon')).toBe(PHONE_LANGUAGE);
    expect(sanitizeDictationLanguage(undefined)).toBe(PHONE_LANGUAGE);
    expect(sanitizeDictationLanguage(42)).toBe(PHONE_LANGUAGE);
    expect(sanitizeDictationLanguage('ur')).toBe('ur');
    expect(sanitizeDictationLanguage(PHONE_LANGUAGE)).toBe(PHONE_LANGUAGE);
  });
});

describe('which model a language needs', () => {
  it('keeps English on the English-only model', () => {
    expect(sttModelKindFor('en')).toBe('english');
  });

  it.each(['hi', 'ur', 'de', 'pl', 'es', 'yue'] as const)(
    'sends %s to the multilingual model',
    (language) => {
      expect(sttModelKindFor(language)).toBe('multilingual');
    }
  );
});

describe('the list of dictation languages', () => {
  it('starts with the languages most of our users speak, in that order', () => {
    expect(DICTATION_LANGUAGES.slice(0, 14).map(({ code }) => code)).toEqual([
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
    ]);
  });

  it('lists the rest alphabetically by name', () => {
    const rest = DICTATION_LANGUAGES.slice(
      DICTATION_LANGUAGES_BY_USER_SHARE.length
    ).map(({ name }) => name);
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b)));
    expect(rest[0]).toBe('Afrikaans');
  });

  it('offers every language Whisper transcribes exactly once', () => {
    const codes = DICTATION_LANGUAGES.map(({ code }) => code);
    expect(codes).toHaveLength(100);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('finds a language by part of its name or by its code', () => {
    expect(filterDictationLanguages('pol').map(({ code }) => code)).toEqual([
      'pl',
    ]);
    expect(filterDictationLanguages('UR').map(({ code }) => code)).toContain(
      'ur'
    );
    expect(filterDictationLanguages('  ')).toBe(DICTATION_LANGUAGES);
    expect(filterDictationLanguages('zzz')).toEqual([]);
  });
});
