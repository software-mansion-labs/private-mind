import { create } from 'zustand';
import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';

export type EmbeddingModelStatus =
  'unknown' | 'not_downloaded' | 'downloading' | 'ready' | 'error';

type EmbeddingModelStore = {
  status: EmbeddingModelStatus;
  progress: number;
  setProgress: (progress: number) => void;
  setStatus: (status: EmbeddingModelStatus) => void;
  markReady: () => void;
  ensureReady: (vectorStore: OPSQLiteVectorStore) => Promise<boolean>;
};

let inFlightLoad: Promise<boolean> | null = null;

export const useEmbeddingModelStore = create<EmbeddingModelStore>(
  (set, get) => ({
    status: 'unknown',
    progress: 0,

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

    ensureReady: async (vectorStore) => {
      if (get().status === 'ready') return true;
      if (inFlightLoad) return inFlightLoad;

      set({ status: 'downloading', progress: 0 });

      inFlightLoad = (async () => {
        try {
          await vectorStore.load();
          set({ status: 'ready', progress: 1 });
          return true;
        } catch (error) {
          console.error('Failed to download/load embedding model', error);
          set({ status: 'error', progress: 0 });
          return false;
        } finally {
          inFlightLoad = null;
        }
      })();

      return inFlightLoad;
    },
  })
);

export const EMBEDDING_STATUS_WAIT_MS = 8000;

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
