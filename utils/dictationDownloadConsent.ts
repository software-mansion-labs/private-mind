import { Alert } from 'react-native';
import type { WhisperLanguage } from 'react-native-executorch';
import { dictationLanguageName } from '../constants/dictation-languages';
import { whisperDownloadSizeLabel } from './sttModelFiles';

export type DictationDownloadChoice = 'download' | 'english' | 'cancel';

export const multilingualDownloadMessage = (language: WhisperLanguage) =>
  `Dictating in ${dictationLanguageName(language)} needs the multilingual speech model, a one-time ${whisperDownloadSizeLabel('multilingual')} download. You can change the dictation language in Settings.`;

export const askToDownloadMultilingualModel = (
  language: WhisperLanguage,
  offerEnglish: boolean
): Promise<DictationDownloadChoice> =>
  new Promise((resolve) => {
    const englishButton = {
      text: 'Use English',
      onPress: () => resolve('english'),
    };
    Alert.alert(
      `Dictate in ${dictationLanguageName(language)}?`,
      multilingualDownloadMessage(language),
      [
        ...(offerEnglish ? [englishButton] : []),
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve('cancel'),
        },
        {
          text: `Download ${whisperDownloadSizeLabel('multilingual')}`,
          onPress: () => resolve('download'),
        },
      ],
      { cancelable: true, onDismiss: () => resolve('cancel') }
    );
  });
