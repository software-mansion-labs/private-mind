import {
  SpeechToTextModule,
  WHISPER_TINY_EN,
} from 'react-native-executorch/legacy';
import { create } from 'zustand';
import { pauseModelDownloadsWhile } from './modelStore';
import {
  cancelWhisperFetch,
  fetchWhisperFiles,
  isWhisperDownloaded,
} from '../utils/sttModelFiles';

const FILES_PROGRESS_INTERVAL_MS = 250;

export interface STTStore {
  module: SpeechToTextModule | null;
  isReady: boolean;
  isLoading: boolean;
  isDownloading: boolean;
  loadProgress: number;
  isFetchingFiles: boolean;
  filesProgress: number;
  streamEnd: Promise<void> | null;
  audioSessionOwner: number;
  ensureLoaded: () => Promise<void>;
  fetchFiles: () => Promise<boolean>;
  cancelFetchFiles: () => Promise<void>;
  trackStream: (end: Promise<void>) => void;
  discardModule: () => void;
  claimAudioSession: () => number;
}

export const useSTTStore = create<STTStore>((set, get) => {
  let modelLoadPromise: null | Promise<void> = null;
  let filesFetchPromise: null | Promise<boolean> = null;

  return {
    module: null,
    isReady: false,
    isLoading: false,
    isDownloading: false,
    loadProgress: 0,
    isFetchingFiles: false,
    filesProgress: 0,
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
        isDownloading: false,
        loadProgress: 0,
      });
      Promise.resolve(streamEnd).then(() => module?.delete());
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

      const loadModule = () =>
        SpeechToTextModule.fromModelName(
          WHISPER_TINY_EN,
          undefined,
          (progress) => {
            set({ loadProgress: progress });
          }
        );

      const whisperOnDisk = filesFetchPromise
        ? filesFetchPromise.then(() => isWhisperDownloaded())
        : isWhisperDownloaded();

      return (modelLoadPromise = whisperOnDisk
        .then((downloaded) => {
          if (downloaded) return loadModule();
          set({ isDownloading: true });
          return pauseModelDownloadsWhile(loadModule);
        })
        .then((module) => {
          set({
            module,
            isReady: true,
            isLoading: false,
            isDownloading: false,
            loadProgress: 1,
          });
        })
        .catch((error) => {
          set({
            isReady: false,
            isLoading: false,
            isDownloading: false,
            loadProgress: 0,
          });
          throw error;
        })
        .finally(() => {
          modelLoadPromise = null;
        }));
    },

    fetchFiles: () => {
      if (filesFetchPromise) return filesFetchPromise;

      set({ isFetchingFiles: true, filesProgress: 0 });
      let lastPublishedAt = 0;
      const publishProgress = (progress: number) => {
        const now = Date.now();
        if (now - lastPublishedAt < FILES_PROGRESS_INTERVAL_MS) return;
        lastPublishedAt = now;
        set({ filesProgress: progress });
      };

      return (filesFetchPromise = fetchWhisperFiles(publishProgress)
        .catch(() => false)
        .then((fetched) => {
          set({ isFetchingFiles: false, filesProgress: fetched ? 1 : 0 });
          return fetched;
        })
        .finally(() => {
          filesFetchPromise = null;
        }));
    },

    cancelFetchFiles: async () => {
      if (filesFetchPromise) await cancelWhisperFetch();
    },
  };
});
