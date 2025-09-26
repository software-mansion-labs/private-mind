import {
  SpeechToTextModelConfig,
  SpeechToTextModule,
} from 'react-native-executorch';
import { create } from 'zustand';
import { getModelConfig, WHISPER_TINY_EN_MODEL } from '../utils/modelConfig';

const getWhisperAssets = async (): Promise<SpeechToTextModelConfig> => {
  const config = await getModelConfig(WHISPER_TINY_EN_MODEL);
  return {
    decoderSource: config.decoderSource!,
    encoderSource: config.encoderSource!,
    tokenizerSource: config.tokenizerSource!,
    isMultilingual: false,
  };
};

export interface STTStore {
  module: SpeechToTextModule;
  isReady: boolean;
  isLoading: boolean;
  loadProgress: number;
  ensureLoaded: () => Promise<void>;
}

export const useSTTStore = create<STTStore>((set, get) => {
  let modelLoadPromise: null | Promise<void> = null;

  return {
    module: new SpeechToTextModule(),
    isReady: false,
    isLoading: false,
    loadProgress: 0,

    ensureLoaded: async () => {
      if (get().isReady) return;

      if (modelLoadPromise) {
        await modelLoadPromise;
        return;
      }

      set({
        isLoading: true,
        loadProgress: 0,
      });

      return (modelLoadPromise = getWhisperAssets()
        .then((assets) =>
          get().module.load(assets, (progress) => {
            set({ loadProgress: progress });
          })
        )
        .then(() => {
          set({
            isReady: true,
            isLoading: false,
            loadProgress: 1,
          });
        })
        .catch((error) => {
          set({
            isReady: false,
            isLoading: false,
            loadProgress: 0,
          });
          throw error;
        })
        .finally(() => {
          modelLoadPromise = null;
        }));
    },
  };
});
