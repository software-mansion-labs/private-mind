import { create } from 'zustand';
import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import {
  cancelEmbeddingModelFetch,
  fetchEmbeddingModelFiles,
} from '../utils/embeddingModel';
import {
  StorageShortfall,
  isOutOfSpaceError,
  shortfallBehind,
} from '../utils/storageSpace';
import { LFM_2_5_EMBEDDING_DOWNLOAD_SIZE_BYTES } from '../constants/embedding-model';

export type EmbeddingModelStatus =
  'unknown' | 'not_downloaded' | 'downloading' | 'ready' | 'error';

export type EmbeddingModelLoader = (
  load: () => Promise<unknown>
) => Promise<unknown>;

const loadInPlace: EmbeddingModelLoader = (load) => load();

type EmbeddingModelStore = {
  status: EmbeddingModelStatus;
  progress: number;
  failedForStorage: { shortfall?: StorageShortfall } | null;
  setProgress: (progress: number) => void;
  setStatus: (status: EmbeddingModelStatus) => void;
  markReady: () => void;
  ensureReady: (
    vectorStore: OPSQLiteVectorStore,
    loadModel?: EmbeddingModelLoader
  ) => Promise<boolean>;
  cancelDownload: () => Promise<void>;
};

interface LoadAttempt {
  cancelled: boolean;
  stage: 'queued' | 'fetching' | 'loading' | 'settled';
  result: Promise<boolean>;
}

let currentAttempt: LoadAttempt | null = null;

export const useEmbeddingModelStore = create<EmbeddingModelStore>(
  (set, get) => ({
    status: 'unknown',
    progress: 0,
    failedForStorage: null,

    setProgress: (progress) => {
      const clamped = Number.isFinite(progress)
        ? Math.min(1, Math.max(0, progress))
        : 0;
      const current = get().progress;
      if (
        clamped !== 1 &&
        Math.round(clamped * 100) === Math.round(current * 100)
      ) {
        return;
      }
      set({ progress: clamped });
    },
    setStatus: (status) => set({ status }),
    markReady: () => set({ status: 'ready', progress: 1 }),

    ensureReady: async (vectorStore, loadModel = loadInPlace) => {
      if (get().status === 'ready') return true;

      const previous = currentAttempt;
      if (previous && !previous.cancelled) return previous.result;

      const attempt: LoadAttempt = {
        cancelled: false,
        stage: 'queued',
        result: Promise.resolve(false),
      };
      currentAttempt = attempt;
      set({ status: 'downloading', progress: 0, failedForStorage: null });

      const run = async () => {
        try {
          if (attempt.cancelled) return false;
          attempt.stage = 'fetching';
          const fetched = await fetchEmbeddingModelFiles((progress) => {
            if (!attempt.cancelled) get().setProgress(progress);
          });
          if (attempt.cancelled) return false;
          if (!fetched) {
            throw new Error('The embedding model download was interrupted');
          }
          attempt.stage = 'loading';
          set({ progress: 1 });
          await loadModel(() => vectorStore.load());
          set({ status: 'ready', progress: 1 });
          return true;
        } catch (error) {
          if (attempt.cancelled) return false;
          console.error('Failed to download/load embedding model', error);
          set({
            status: 'error',
            progress: 0,
            failedForStorage: isOutOfSpaceError(error)
              ? {
                  shortfall: shortfallBehind(
                    error,
                    LFM_2_5_EMBEDDING_DOWNLOAD_SIZE_BYTES
                  ),
                }
              : null,
          });
          return false;
        } finally {
          if (attempt.stage === 'fetching') attempt.stage = 'settled';
          if (currentAttempt === attempt) currentAttempt = null;
        }
      };

      attempt.result = previous ? previous.result.then(run) : run();
      return attempt.result;
    },

    cancelDownload: async () => {
      const attempt = currentAttempt;
      if (!attempt || attempt.cancelled || attempt.stage === 'loading') return;
      attempt.cancelled = true;
      set({ status: 'not_downloaded', progress: 0 });
      await cancelEmbeddingModelFetch(() => attempt.stage === 'fetching');
    },
  })
);

export const EMBEDDING_STATUS_WAIT_MS = 8000;

export const WEB_TOGGLE_STATUS_WAIT_MS = 45000;

export const whenEmbeddingStatusKnown = (
  timeoutMs: number = EMBEDDING_STATUS_WAIT_MS
): Promise<EmbeddingModelStatus> =>
  new Promise((resolve) => {
    const current = useEmbeddingModelStore.getState().status;
    if (current !== 'unknown') {
      resolve(current);
      return;
    }
    let unsubscribe = () => {};
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(useEmbeddingModelStore.getState().status);
    }, timeoutMs);
    unsubscribe = useEmbeddingModelStore.subscribe((state) => {
      if (state.status === 'unknown') return;
      clearTimeout(timer);
      unsubscribe();
      resolve(state.status);
    });
  });

export const embeddingModelNeedsDownloadPrompt = (
  status: EmbeddingModelStatus
): boolean => status !== 'ready' && status !== 'unknown';
