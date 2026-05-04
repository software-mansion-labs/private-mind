import { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';
import {
  Model,
  getAllModels,
  addModel,
  updateModelDownloaded,
  removeModelFiles,
  updateModel,
} from '../database/modelRepository';
import Toast from 'react-native-toast-message';
import { ResourceFetcher } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';

export enum ModelState {
  Downloaded = 'downloaded',
  Downloading = 'downloading',
  NotStarted = 'not_started',
}

interface DownloadState {
  progress: number;
  status: ModelState;
}

interface ModelStore {
  db: SQLiteDatabase | null;
  models: Model[];
  downloadedModels: Model[];
  downloadStates: Record<string, DownloadState>;
  setDB: (db: SQLiteDatabase) => void;
  loadModels: () => Promise<void>;
  addModelToDB: (model: Omit<Model, 'id'>) => Promise<void>;
  getModelById: (id: number) => Model | undefined;
  downloadModel: (model: Model) => Promise<void>;
  cancelDownload: (model: Model) => Promise<void>;
  removeModel: (modelId: number) => Promise<void>;
  removeModelFiles: (modelId: number) => Promise<void>;
  editModel: (
    modelId: number,
    localTokenizerPath: string,
    localTokenizerConfigPath: string,
    newModelName: string
  ) => Promise<void>;
}

const MS_PER_FRAME = 16; // ~60 fps

// Wrapper around ExpoResourceFetcher.deleteResources that swallows errors.
// We pass model.* source paths (URLs); the fetcher derives the on-disk
// filename and deletes only files it manages — never user-supplied local paths.
async function deleteRemoteResources(...sources: string[]) {
  try {
    await ExpoResourceFetcher.deleteResources(...sources);
  } catch (err) {
    console.warn('ExpoResourceFetcher.deleteResources failed:', err);
  }
}

export const useModelStore = create<ModelStore>((set, get) => ({
  db: null,
  models: [],
  downloadedModels: [],
  downloadStates: {},

  setDB: (db) => set({ db }),

  getModelById: (id: number) => {
    const models = get().models;
    return models.find((model) => model.id === id);
  },

  loadModels: async () => {
    const db = get().db;
    if (!db) return;
    const models = await getAllModels(db);
    set({
      models,
      downloadedModels: models.filter((m) => m.isDownloaded),
    });
  },

  addModelToDB: async (model: Omit<Model, 'id'>) => {
    const db = get().db;
    if (!db) return;
    await addModel(db, model);
    await get().loadModels();
  },

  downloadModel: async (model: Model) => {
    const setDownloading = (
      progress: number,
      status: DownloadState['status']
    ) => {
      set((state) => ({
        downloadStates: {
          ...state.downloadStates,
          [model.id]: { progress, status },
        },
      }));
    };

    let lastReportedPercent = -1;

    // used for avoiding updates more frequent than 60 per second, which can cause
    // glitches due to the UI becoming out of sync with the actual progress
    let lastReportTime = Date.now();

    // prevent race condition where for fast responses last progress updates happen after
    // its finished and make the download state appear stuck on "downloading"
    let downloadDone = false;
    setDownloading(0, ModelState.Downloading);

    try {
      const { modelPath, tokenizerPath, tokenizerConfigPath } = model;

      const result = await ResourceFetcher.fetch(
        (p: number) => {
          const currentPercent = Math.floor(p * 100);
          if (
            !downloadDone &&
            currentPercent !== lastReportedPercent &&
            lastReportTime + MS_PER_FRAME < Date.now()
          ) {
            lastReportedPercent = currentPercent;
            lastReportTime = Date.now();
            setDownloading(p, ModelState.Downloading);
          }
        },
        modelPath,
        tokenizerPath,
        tokenizerConfigPath
      );

      if (result === null) {
        return;
      }

      const db = get().db;
      if (db) {
        await updateModelDownloaded(db, model.id, 1);
        await get().loadModels();
      }

      downloadDone = true;
      setDownloading(1, ModelState.Downloaded);
      Toast.show({
        type: 'defaultToast',
        text1: `${model.modelName} has been successfully downloaded`,
      });
    } catch (err) {
      console.error('Failed:', err);
      setDownloading(0, ModelState.NotStarted);
      Toast.show({
        type: 'defaultToast',
        text1: 'The model could not be downloaded',
      });
    }
  },

  cancelDownload: async (model: Model) => {
    const { modelPath, tokenizerPath, tokenizerConfigPath } = model;
    try {
      await ExpoResourceFetcher.cancelFetching(
        modelPath,
        tokenizerPath,
        tokenizerConfigPath
      );
    } catch (e) {
      console.warn('Failed to cancel download:', e);
    }
    set((state) => ({
      downloadStates: {
        ...state.downloadStates,
        [model.id]: { progress: 0, status: ModelState.NotStarted },
      },
    }));
  },

  removeModelFiles: async (modelId: number) => {
    const db = get().db;
    if (!db) return;

    const model = get().models.find((m) => m.id === modelId);
    if (!model) return;

    try {
      // Only `local` models point at user-provided files we must never touch.
      // `remote` and `built-in` both download into the app sandbox via the
      // resource fetcher, so the same cleanup path applies to both.
      if (model.source !== 'local') {
        await deleteRemoteResources(
          model.modelPath,
          model.tokenizerPath,
          model.tokenizerConfigPath
        );
      }
      await updateModelDownloaded(db, modelId, 0);
      await get().loadModels();
      set((state) => {
        const { [modelId]: _, ...rest } = state.downloadStates;
        return { downloadStates: rest };
      });
    } catch (err) {
      console.error('Failed to remove model files:', err);
    }
  },

  removeModel: async (modelId: number) => {
    const db = get().db;
    if (!db) return;

    const model = get().models.find((m) => m.id === modelId);
    if (!model) return;

    try {
      // Reuse removeModelFiles so file cleanup + state reset stay in one place.
      await get().removeModelFiles(modelId);
      await removeModelFiles(db, modelId);
      await get().loadModels();
    } catch (err) {
      console.error('Failed to remove model:', err);
    }
  },

  editModel: async (
    modelId: number,
    localTokenizerPath: string,
    localTokenizerConfigPath: string,
    newModelName: string
  ) => {
    const db = get().db;
    if (!db) return;

    const model = get().models.find((m) => m.id === modelId);
    if (!model) return;

    try {
      if (model.source === 'remote' && model.isDownloaded) {
        const oldSources: string[] = [];
        const newSources: string[] = [];

        if (model.tokenizerPath !== localTokenizerPath) {
          oldSources.push(model.tokenizerPath);
          newSources.push(localTokenizerPath);
        }

        if (model.tokenizerConfigPath !== localTokenizerConfigPath) {
          oldSources.push(model.tokenizerConfigPath);
          newSources.push(localTokenizerConfigPath);
        }

        if (oldSources.length > 0) {
          // Delete only the on-disk copies of the changed sources, leaving
          // the model file alone.
          await deleteRemoteResources(...oldSources);
        }

        if (newSources.length > 0) {
          await ResourceFetcher.fetch(() => {}, ...newSources);
        }
      }

      await updateModel(db, {
        modelId,
        tokenizerPath: localTokenizerPath,
        tokenizerConfigPath: localTokenizerConfigPath,
        newModelName,
      });
      await get().loadModels();
    } catch (err) {
      console.error('Failed to edit local model:', err);
    }
  },
}));
