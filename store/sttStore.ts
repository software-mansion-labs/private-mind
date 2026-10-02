import {
  SpeechToTextModule,
  WHISPER_TINY_EN,
} from 'react-native-executorch/legacy';
import { create } from 'zustand';

export interface STTStore {
  module: SpeechToTextModule | null;
  isReady: boolean;
  isLoading: boolean;
  loadProgress: number;
  streamEnd: Promise<void> | null;
  ensureLoaded: () => Promise<void>;
  trackStream: (end: Promise<void>) => void;
  discardModule: () => void;
}

export const useSTTStore = create<STTStore>((set, get) => {
  let modelLoadPromise: null | Promise<void> = null;

  return {
    module: null,
    isReady: false,
    isLoading: false,
    loadProgress: 0,
    streamEnd: null,

    trackStream: (end) => {
      set({ streamEnd: end });
      end.then(() => {
        if (get().streamEnd === end) set({ streamEnd: null });
      });
    },
    discardModule: () => {
      const { module, streamEnd } = get();
      set({
        module: null,
        isReady: false,
        isLoading: false,
        loadProgress: 0,
      });
      Promise.resolve(streamEnd).then(() => module?.delete());
    },

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
        undefined,
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
