import {
  createWhisperSpeechToText,
  type WhisperSpeechToText,
} from 'react-native-executorch';
import { create } from 'zustand';
import { pauseModelDownloadsWhile } from './modelStore';
import {
  STT_MODEL_KINDS,
  type SttModelKind,
  cancelWhisperFetch,
  deleteWhisperFiles,
  fetchWhisperFiles,
  isWhisperDownloaded,
  localWhisperModel,
  whisperDownloadSizeBytes,
} from '../utils/sttModelFiles';
import {
  ensureStorageFor,
  isOutOfSpaceError,
  shortfallBehind,
  showNotEnoughStorage,
} from '../utils/storageSpace';

const FILES_PROGRESS_INTERVAL_MS = 250;

export type SpeechToTextModule = WhisperSpeechToText;

export type SttModelsOnDisk = Record<SttModelKind, boolean>;

export interface STTStore {
  module: SpeechToTextModule | null;
  moduleKind: SttModelKind | null;
  requestedKind: SttModelKind;
  isReady: boolean;
  isLoading: boolean;
  isDownloading: boolean;
  loadProgress: number;
  isFetchingFiles: boolean;
  fetchingKind: SttModelKind | null;
  filesProgress: number;
  onDisk: SttModelsOnDisk;
  streamEnd: Promise<void> | null;
  audioSessionOwner: number;
  ensureLoaded: (kind?: SttModelKind) => Promise<void>;
  fetchFiles: (kind?: SttModelKind) => Promise<boolean>;
  cancelFetchFiles: () => Promise<void>;
  refreshOnDisk: () => Promise<SttModelsOnDisk>;
  deleteModelFiles: (kind: SttModelKind) => Promise<void>;
  releaseModelOtherThan: (kind: SttModelKind) => void;
  trackStream: (end: Promise<void>) => void;
  discardModule: () => void;
  claimAudioSession: () => number;
}

interface FilesFetch {
  kind: SttModelKind;
  cancelled: boolean;
  fetching: boolean;
  result: Promise<boolean>;
}

interface ModelLoad {
  kind: SttModelKind;
  promise: Promise<void>;
}

const NOTHING_ON_DISK: SttModelsOnDisk = {
  english: false,
  multilingual: false,
};

const ignoreFailure = () => undefined;

export const useSTTStore = create<STTStore>((set, get) => {
  let modelLoad: ModelLoad | null = null;
  let filesFetch: FilesFetch | null = null;
  let released: Promise<void> = Promise.resolve();

  const markOnDisk = (kind: SttModelKind, present: boolean) =>
    set((state) => ({ onDisk: { ...state.onDisk, [kind]: present } }));

  return {
    module: null,
    moduleKind: null,
    requestedKind: 'english',
    isReady: false,
    isLoading: false,
    isDownloading: false,
    loadProgress: 0,
    isFetchingFiles: false,
    fetchingKind: null,
    filesProgress: 0,
    onDisk: NOTHING_ON_DISK,
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
        moduleKind: null,
        isReady: false,
        isLoading: false,
        isDownloading: false,
        loadProgress: 0,
      });
      const release = Promise.resolve(streamEnd).then(() => module?.dispose());
      released = Promise.all([released, release]).then(
        ignoreFailure,
        ignoreFailure
      );
    },
    claimAudioSession: () => {
      const claim = get().audioSessionOwner + 1;
      set({ audioSessionOwner: claim });
      return claim;
    },

    ensureLoaded: async (kind = 'english') => {
      const current = get();
      if (current.isReady && current.moduleKind === kind) return;

      if (modelLoad) {
        if (modelLoad.kind === kind) return modelLoad.promise;
        await modelLoad.promise.catch(ignoreFailure);
        return get().ensureLoaded(kind);
      }

      if (current.module) get().discardModule();

      set({
        isLoading: true,
        loadProgress: 0,
        requestedKind: kind,
      });

      const loadModule = async () =>
        createWhisperSpeechToText(
          await localWhisperModel(kind, (progress) => {
            set({ loadProgress: progress });
          })
        );

      const pendingFetch = filesFetch?.kind === kind ? filesFetch : null;
      const whisperOnDisk = pendingFetch
        ? pendingFetch.result.then(() => isWhisperDownloaded(kind))
        : isWhisperDownloaded(kind);

      const load: ModelLoad = {
        kind,
        promise: Promise.all([whisperOnDisk, released])
          .then(([downloaded]) => {
            if (downloaded) return loadModule();
            ensureStorageFor(whisperDownloadSizeBytes(kind));
            set({ isDownloading: true });
            return pauseModelDownloadsWhile(loadModule);
          })
          .then((module) => {
            set({
              module,
              moduleKind: kind,
              isReady: true,
              isLoading: false,
              isDownloading: false,
              loadProgress: 1,
            });
            markOnDisk(kind, true);
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
            if (modelLoad === load) modelLoad = null;
          }),
      };
      modelLoad = load;
      return load.promise;
    },

    fetchFiles: (kind = 'english') => {
      const previous = filesFetch;
      if (previous && !previous.cancelled && previous.kind === kind) {
        return previous.result;
      }

      const attempt: FilesFetch = {
        kind,
        cancelled: false,
        fetching: false,
        result: Promise.resolve(false),
      };
      filesFetch = attempt;
      set({ isFetchingFiles: true, fetchingKind: kind, filesProgress: 0 });

      let lastPublishedAt = 0;
      const publishProgress = (progress: number) => {
        if (attempt.cancelled) return;
        const now = Date.now();
        if (now - lastPublishedAt < FILES_PROGRESS_INTERVAL_MS) return;
        lastPublishedAt = now;
        set({ filesProgress: progress });
      };

      const run = async () => {
        if (attempt.cancelled) return false;
        attempt.fetching = true;
        const fetched = await fetchWhisperFiles(kind, publishProgress)
          .catch((error) => {
            if (isOutOfSpaceError(error)) {
              showNotEnoughStorage(
                'Voice dictation',
                shortfallBehind(error, whisperDownloadSizeBytes(kind))
              );
            }
            return false;
          })
          .finally(() => {
            attempt.fetching = false;
          });
        if (attempt.cancelled) return false;
        if (fetched) markOnDisk(kind, true);
        if (filesFetch === attempt) {
          set({
            isFetchingFiles: false,
            fetchingKind: null,
            filesProgress: fetched ? 1 : 0,
          });
        }
        return fetched;
      };

      attempt.result = (previous ? previous.result.then(run) : run()).finally(
        () => {
          if (filesFetch === attempt) filesFetch = null;
        }
      );
      return attempt.result;
    },

    cancelFetchFiles: async () => {
      const attempt = filesFetch;
      if (!attempt || attempt.cancelled) return;
      attempt.cancelled = true;
      set({ isFetchingFiles: false, fetchingKind: null, filesProgress: 0 });
      await cancelWhisperFetch(attempt.kind, () => attempt.fetching);
    },

    refreshOnDisk: async () => {
      const present = await Promise.all(
        STT_MODEL_KINDS.map(isWhisperDownloaded)
      );
      const onDisk = { ...NOTHING_ON_DISK };
      STT_MODEL_KINDS.forEach((kind, index) => {
        onDisk[kind] = present[index] ?? false;
      });
      set({ onDisk });
      return onDisk;
    },

    releaseModelOtherThan: (kind) => {
      const { module, moduleKind } = get();
      if (module && moduleKind !== kind) get().discardModule();
    },

    deleteModelFiles: async (kind) => {
      if (filesFetch?.kind === kind) await get().cancelFetchFiles();
      if (modelLoad?.kind === kind) {
        await modelLoad.promise.catch(ignoreFailure);
      }
      if (get().moduleKind === kind) get().discardModule();
      await released;
      await deleteWhisperFiles(kind);
      markOnDisk(kind, false);
    },
  };
});
