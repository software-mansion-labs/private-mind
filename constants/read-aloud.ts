import type {
  ReverbDefaultVoiceName,
  ReverbLanguage,
} from 'react-native-executorch';

export const READ_ALOUD_VOICES: Record<ReverbLanguage, ReverbDefaultVoiceName> =
  {
    de: 'de_female_standard',
    en: 'en_female_narrator',
    es: 'es_male_standard_1',
    fr: 'fr_female_standard',
    it: 'it_male_standard',
    pl: 'pl_male_standard',
    pt: 'pt_female_standard',
  };

export const MAX_SPOKEN_CHARACTERS = 3000;
export const LANGUAGE_SAMPLE_CHARACTERS = 600;
export const MIN_SPOKEN_CHARACTERS = 2;
export const PLAYBACK_START_TIMEOUT_MS = 30_000;
export const READ_ALOUD_MODEL_FILES_LABEL = 'Read aloud';
export const READ_ALOUD_PROGRESS_INTERVAL_MS = 250;
