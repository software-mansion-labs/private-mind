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

    setProgress: (progress) =>
      set({
        progress: Number.isFinite(progress)
          ? Math.min(1, Math.max(0, progress))
          : 0,
      }),
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
