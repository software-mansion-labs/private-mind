import { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';
import {
  Model,
  getAllModels,
  addModel,
  updateModelDownloaded,
  removeModelFiles,
  updateModel,
  syncBuiltInModelPaths,
} from '../database/modelRepository';
import Toast from 'react-native-toast-message';
import {
  ResourceFetcher,
  RnExecutorchErrorCode,
} from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
import { Feedback } from '../utils/Feedback';
import {
  describeDownloadError,
  recordDownloadEvent,
} from '../utils/downloadDiagnostics';

export enum ModelState {
  Downloaded = 'downloaded',
  Downloading = 'downloading',
  NotStarted = 'not_started',
}

interface DownloadState {
  progress: number;
  status: ModelState;
}

interface DownloadAttempt {
  cancelled: boolean;
  fetching: boolean;
  finished: boolean;
  settled: Promise<void>;
}

const attempts = new Map<number, DownloadAttempt>();

export const resetDownloadAttempts = () => attempts.clear();

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

const CANCEL_POLL_MS = 50;
const CANCEL_DEADLINE_MS = 30_000;

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const errorCode = (error: unknown): unknown =>
  typeof error === 'object' && error !== null
    ? (error as { code?: unknown }).code
    : undefined;

const isNotFetchingYet = (error: unknown) =>
  errorCode(error) === RnExecutorchErrorCode.ResourceFetcherNotActive;

const stopFetching = async (model: Model, attempt: DownloadAttempt) => {
  const { modelPath, tokenizerPath, tokenizerConfigPath } = model;
  const deadline = Date.now() + CANCEL_DEADLINE_MS;

  while (!attempt.finished && attempt.fetching) {
    if (Date.now() > deadline) {
      recordDownloadEvent(
        model.id,
        model.modelName,
        'cancel-failed',
        'the fetcher never registered the download'
      );
      return;
    }

    try {
      await ExpoResourceFetcher.cancelFetching(
        modelPath,
        tokenizerPath,
        tokenizerConfigPath
      );
      recordDownloadEvent(model.id, model.modelName, 'cancel-landed');
      return;
    } catch (err) {
      if (!isNotFetchingYet(err)) {
        recordDownloadEvent(
          model.id,
          model.modelName,
          'cancel-failed',
          describeDownloadError(err)
        );
        console.warn('Failed to cancel download:', err);
        return;
      }
      recordDownloadEvent(model.id, model.modelName, 'cancel-waiting');
      await wait(CANCEL_POLL_MS);
    }
  }
};

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

const runDownload = async (model: Model, attempt: DownloadAttempt) => {
  const isCurrent = () =>
    attempts.get(model.id) === attempt && !attempt.cancelled;

  const publish = (progress: number, status: DownloadState['status']) => {
    if (!isCurrent()) return;
    useModelStore.setState((state) => ({
      downloadStates: {
        ...state.downloadStates,
        [model.id]: { progress, status },
      },
    }));
  };

  try {
    if (attempt.cancelled) {
      recordDownloadEvent(
        model.id,
        model.modelName,
        'abandoned',
        'cancelled while queued'
      );
      return;
    }

    recordDownloadEvent(model.id, model.modelName, 'started');

    let lastReportedPercent = -1;

    // used for avoiding updates more frequent than 60 per second, which can cause
    // glitches due to the UI becoming out of sync with the actual progress
    let lastReportTime = Date.now();

    const { modelPath, tokenizerPath, tokenizerConfigPath } = model;

    try {
      attempt.fetching = true;
      await ResourceFetcher.fetch(
        (p: number) => {
          const currentPercent = Math.floor(p * 100);
          if (
            currentPercent !== lastReportedPercent &&
            lastReportTime + MS_PER_FRAME < Date.now()
          ) {
            lastReportedPercent = currentPercent;
            lastReportTime = Date.now();
            publish(p, ModelState.Downloading);
          }
        },
        modelPath,
        tokenizerPath,
        tokenizerConfigPath
      );

      if (!isCurrent()) {
        recordDownloadEvent(
          model.id,
          model.modelName,
          'abandoned',
          'finished after the user moved on'
        );
        return;
      }

      const db = useModelStore.getState().db;
      if (db) {
        await updateModelDownloaded(db, model.id, 1);
        await useModelStore.getState().loadModels();
      }

      if (!isCurrent()) return;
      publish(1, ModelState.Downloaded);
      recordDownloadEvent(model.id, model.modelName, 'completed');
      Feedback.downloadComplete();
      Toast.show({
        type: 'defaultToast',
        text1: `${model.modelName} has been successfully downloaded`,
      });
    } catch (err) {
      if (!isCurrent()) {
        recordDownloadEvent(
          model.id,
          model.modelName,
          'abandoned',
          describeDownloadError(err)
        );
        return;
      }
      publish(0, ModelState.NotStarted);
      recordDownloadEvent(
        model.id,
        model.modelName,
        'failed',
        describeDownloadError(err)
      );
      console.error('Failed:', err);
      Toast.show({
        type: 'defaultToast',
        text1: 'The model could not be downloaded',
      });
    }
  } finally {
    attempt.fetching = false;
    attempt.finished = true;
    if (attempts.get(model.id) === attempt) attempts.delete(model.id);
  }
};

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
    const previous = attempts.get(model.id);
    if (previous && !previous.cancelled) return;

    recordDownloadEvent(model.id, model.modelName, 'requested');

    const attempt: DownloadAttempt = {
      cancelled: false,
      fetching: false,
      finished: false,
      settled: Promise.resolve(),
    };
    attempt.settled = (previous?.settled ?? Promise.resolve())
      .then(() => runDownload(model, attempt))
      .catch((err) => {
        recordDownloadEvent(
          model.id,
          model.modelName,
          'failed',
          describeDownloadError(err)
        );
        console.error('Download attempt crashed:', err);
      });
    attempts.set(model.id, attempt);
    set((state) => ({
      downloadStates: {
        ...state.downloadStates,
        [model.id]: { progress: 0, status: ModelState.Downloading },
      },
    }));

    if (previous) {
      recordDownloadEvent(
        model.id,
        model.modelName,
        'queued',
        'waiting for the cancelled download to stop'
      );
    }

    await attempt.settled;
  },

  cancelDownload: async (model: Model) => {
    const attempt = attempts.get(model.id);
    recordDownloadEvent(
      model.id,
      model.modelName,
      'cancel-requested',
      attempt ? undefined : 'nothing in flight'
    );

    set((state) => ({
      downloadStates: {
        ...state.downloadStates,
        [model.id]: { progress: 0, status: ModelState.NotStarted },
      },
    }));

    if (!attempt) return;
    attempt.cancelled = true;
    await stopFetching(model, attempt);
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
      // Re-sync stored URLs so an immediate re-download uses current paths.
      if (model.source === 'built-in') {
        await syncBuiltInModelPaths(db, modelId, model.modelName);
      }
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
