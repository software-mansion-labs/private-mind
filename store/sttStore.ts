import {
  SpeechToTextModule,
  WHISPER_TINY_EN,
} from 'react-native-executorch';
import { create } from 'zustand';

export interface STTStore {
  module: SpeechToTextModule | null;
  isReady: boolean;
  isLoading: boolean;
  loadProgress: number;
  ensureLoaded: () => Promise<void>;
}

export const useSTTStore = create<STTStore>((set, get) => {
  let modelLoadPromise: null | Promise<void> = null;

  return {
    module: null,
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

      return (modelLoadPromise = SpeechToTextModule.fromModelName(
        WHISPER_TINY_EN,
        (progress) => {
          set({ loadProgress: progress });
        }
      )
        .then((module) => {
          set({
            module,
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
