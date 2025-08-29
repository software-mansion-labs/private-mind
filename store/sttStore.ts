import {
  SpeechToTextModelConfig,
  SpeechToTextModule,
} from 'react-native-executorch';
import { create } from 'zustand';

const WHISPER_TINY_EN_ASSETS: SpeechToTextModelConfig = {
  decoderSource: require('../assets/models/whisper-tiny-en/whisper_tiny_en_decoder_xnnpack.pte'),
  encoderSource: require('../assets/models/whisper-tiny-en/whisper_tiny_en_encoder_xnnpack.pte'),
  tokenizerSource: require('../assets/models/whisper-tiny-en/tokenizer.json'),
  isMultilingual: false,
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

      return (modelLoadPromise = get()
        .module.load(WHISPER_TINY_EN_ASSETS, (progress) => {
          set({ loadProgress: progress });
        })
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
