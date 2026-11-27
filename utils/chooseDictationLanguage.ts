import type { WhisperLanguage } from 'react-native-executorch';
import { ENGLISH_DICTATION_LANGUAGE } from '../constants/dictation-languages';
import { useSettingsStore } from '../store/settingsStore';
import { useSTTStore } from '../store/sttStore';
import { askToDownloadMultilingualModel } from './dictationDownloadConsent';
import {
  type DictationLanguagePreference,
  resolveDictationLanguage,
  sttModelKindFor,
} from './dictationLanguage';
import { isWhisperDownloaded } from './sttModelFiles';

const multilingualModelAvailable = async () => {
  const { moduleKind, fetchingKind } = useSTTStore.getState();
  if (moduleKind === 'multilingual' || fetchingKind === 'multilingual') {
    return true;
  }
  return isWhisperDownloaded('multilingual');
};

export const chooseDictationLanguage =
  async (): Promise<WhisperLanguage | null> => {
    const { dictationLanguage, setDictationLanguage } =
      useSettingsStore.getState();
    const language = resolveDictationLanguage(dictationLanguage);
    if (sttModelKindFor(language) === 'english') return language;
    if (await multilingualModelAvailable()) return language;

    const choice = await askToDownloadMultilingualModel(language, true);
    if (choice === 'download') return language;
    if (choice === 'english') {
      setDictationLanguage(ENGLISH_DICTATION_LANGUAGE);
      return ENGLISH_DICTATION_LANGUAGE;
    }
    return null;
  };

export const pickDictationLanguage = async (
  next: DictationLanguagePreference
): Promise<boolean> => {
  const language = resolveDictationLanguage(next);
  const kind = sttModelKindFor(language);
  const needsDownload =
    kind === 'multilingual' && !(await multilingualModelAvailable());
  if (needsDownload) {
    const choice = await askToDownloadMultilingualModel(language, false);
    if (choice !== 'download') return false;
  }
  useSettingsStore.getState().setDictationLanguage(next);
  useSTTStore.getState().releaseModelOtherThan(kind);
  if (needsDownload) useSTTStore.getState().fetchFiles(kind);
  return true;
};
