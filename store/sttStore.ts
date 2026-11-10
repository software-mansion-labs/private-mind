import {
  createWhisperSpeechToText,
  type WhisperSpeechToText,
} from 'react-native-executorch';
import { create } from 'zustand';
import { localWhisperModel } from '../utils/sttModelFiles';

export type SpeechToTextModule = WhisperSpeechToText<'en'>;

export interface STTStore {
  module: SpeechToTextModule | null;
  isReady: boolean;
  isLoading: boolean;
  loadProgress: number;
  streamEnd: Promise<void> | null;
  audioSessionOwner: number;
  ensureLoaded: () => Promise<void>;
  trackStream: (end: Promise<void>) => void;
  discardModule: () => void;
  claimAudioSession: () => number;
}

export const useSTTStore = create<STTStore>((set, get) => {
  let modelLoadPromise: null | Promise<void> = null;

  return {
    module: null,
    isReady: false,
    isLoading: false,
    loadProgress: 0,
    streamEnd: null,
    audioSessionOwner: 0,

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
      Promise.resolve(streamEnd).then(() => module?.dispose());
    },
    claimAudioSession: () => {
      const claim = get().audioSessionOwner + 1;
      set({ audioSessionOwner: claim });
      return claim;
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

      return (modelLoadPromise = localWhisperModel((progress) => {
        set({ loadProgress: progress });
      })
        .then(createWhisperSpeechToText)
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
