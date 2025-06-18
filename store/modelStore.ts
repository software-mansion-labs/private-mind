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
import { ResourceFetcher } from 'react-native-executorch';
import Toast from 'react-native-toast-message';

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
  removeModel: (modelId: number) => Promise<void>;
  removeModelFiles: (modelId: number) => Promise<void>;
  editModel: (
    modelId: number,
    localTokenizerPath: string,
    localTokenizerConfigPath: string,
    newModelName: string
  ) => Promise<void>;
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

    setDownloading(0, ModelState.Downloading);

    try {
      const { modelPath, tokenizerPath, tokenizerConfigPath } = model;

      await ResourceFetcher.fetch(modelPath, (p: number) => {
        const currentPercent = Math.floor(p * 100);
        if (currentPercent !== lastReportedPercent) {
          lastReportedPercent = currentPercent;
          setDownloading(p, ModelState.Downloading);
        }
      });

      await ResourceFetcher.fetchMultipleResources(
        () => {},
        tokenizerPath,
        tokenizerConfigPath
      );

      const db = get().db;
      if (db) {
        await updateModelDownloaded(db, model.id, 1);
        await get().loadModels();
      }

      setDownloading(1, ModelState.Downloaded);
      Toast.show({
        type: 'defaultToast',
        text1: `${model.modelName} has been successfully downloaded`,
        props: { backgroundColor: '#020f3c' },
      });
    } catch (err) {
      console.error('Failed:', err);
    }
  },

  removeModel: async (modelId: number) => {
    const db = get().db;
    if (!db) return;

    const model = get().models.find((m) => m.id === modelId);
    if (!model) return;

    try {
      if (model.source === 'remote') {
        await ResourceFetcher.deleteMultipleResources(
          model.modelPath,
          model.tokenizerPath,
          model.tokenizerConfigPath
        );
        await updateModelDownloaded(db, modelId, 0);
        set((state) => {
          const { [modelId]: _, ...rest } = state.downloadStates;
          return { downloadStates: rest };
        });
      }

      await removeModelFiles(db, modelId);
      await get().loadModels();
    } catch (err) {
      console.error('Failed to remove files:', err);
    }
  },

  removeModelFiles: async (modelId: number) => {
    const db = get().db;
    if (!db) return;

    const model = get().models.find((m) => m.id === modelId);
    if (!model) return;

    try {
      await ResourceFetcher.deleteMultipleResources(
        model.modelPath,
        model.tokenizerPath,
        model.tokenizerConfigPath
      );
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
      if (model.source === 'remote') {
        await ResourceFetcher.deleteMultipleResources(
          model.tokenizerPath,
          model.tokenizerConfigPath
        );

        await ResourceFetcher.fetchMultipleResources(
          () => {},
          localTokenizerPath,
          localTokenizerConfigPath
        );
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
