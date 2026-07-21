import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateEmbeddingModelIfNeeded } from '../utils/embeddingModelMigration';
import { ACTIVE_EMBEDDING_MODEL_KEY } from '../constants/embedding-model';
import type { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

const CURRENT_DIM = 1024;

const makeVectorStore = (persistedDim?: number) => {
  const deleteVectorStore = jest.fn().mockResolvedValue(undefined);
  const execute = jest.fn().mockResolvedValue({
    rows:
      persistedDim === undefined
        ? []
        : [
            {
              sql: `CREATE TABLE vectors (id TEXT, embedding F32_BLOB(${persistedDim}) NOT NULL)`,
            },
          ],
  });
  return {
    store: {
      deleteVectorStore,
      db: { execute },
    } as unknown as OPSQLiteVectorStore,
    deleteVectorStore,
    execute,
  };
};

const makeDb = () => {
  const runAsync = jest.fn().mockResolvedValue(undefined);
  return { db: { runAsync } as unknown as SQLiteDatabase, runAsync };
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('migrateEmbeddingModelIfNeeded', () => {
  it('no-ops when the stored model matches the current one', async () => {
    await AsyncStorage.setItem(ACTIVE_EMBEDDING_MODEL_KEY, 'model-a');
    const { store, deleteVectorStore } = makeVectorStore();
    const { db, runAsync } = makeDb();

    const migrated = await migrateEmbeddingModelIfNeeded(
      store,
      db,
      'model-a',
      CURRENT_DIM
    );

    expect(migrated).toBe(false);
    expect(deleteVectorStore).not.toHaveBeenCalled();
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('adopts the current model without wiping on a fresh install (no vectors table)', async () => {
    const { store, deleteVectorStore } = makeVectorStore();
    const { db, runAsync } = makeDb();

    const migrated = await migrateEmbeddingModelIfNeeded(
      store,
      db,
      'model-a',
      CURRENT_DIM
    );

    expect(migrated).toBe(false);
    expect(deleteVectorStore).not.toHaveBeenCalled();
    expect(runAsync).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(ACTIVE_EMBEDDING_MODEL_KEY)).toBe(
      'model-a'
    );
  });

  it('adopts without wiping when a lost key sits over dimension-compatible vectors', async () => {
    const { store, deleteVectorStore } = makeVectorStore(CURRENT_DIM);
    const { db, runAsync } = makeDb();

    const migrated = await migrateEmbeddingModelIfNeeded(
      store,
      db,
      'model-a',
      CURRENT_DIM
    );

    expect(migrated).toBe(false);
    expect(deleteVectorStore).not.toHaveBeenCalled();
    expect(runAsync).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(ACTIVE_EMBEDDING_MODEL_KEY)).toBe(
      'model-a'
    );
  });

  it('wipes legacy pre-key sources when the persisted dimension is incompatible (384 to 1024)', async () => {
    const { store, deleteVectorStore } = makeVectorStore(384);
    const { db, runAsync } = makeDb();

    const migrated = await migrateEmbeddingModelIfNeeded(
      store,
      db,
      'lfm-2-5',
      CURRENT_DIM
    );

    expect(migrated).toBe(true);
    expect(deleteVectorStore).toHaveBeenCalledTimes(1);
    expect(runAsync).toHaveBeenCalledWith('DELETE FROM chatSources');
    expect(runAsync).toHaveBeenCalledWith('DELETE FROM sources');
    expect(await AsyncStorage.getItem(ACTIVE_EMBEDDING_MODEL_KEY)).toBe(
      'lfm-2-5'
    );
  });

  it('wipes the vector store and source metadata on a genuine model change', async () => {
    await AsyncStorage.setItem(ACTIVE_EMBEDDING_MODEL_KEY, 'model-old');
    const { store, deleteVectorStore } = makeVectorStore(CURRENT_DIM);
    const { db, runAsync } = makeDb();

    const migrated = await migrateEmbeddingModelIfNeeded(
      store,
      db,
      'model-new',
      CURRENT_DIM
    );

    expect(migrated).toBe(true);
    expect(deleteVectorStore).toHaveBeenCalledTimes(1);
    expect(runAsync).toHaveBeenCalledWith('DELETE FROM chatSources');
    expect(runAsync).toHaveBeenCalledWith('DELETE FROM sources');
    expect(await AsyncStorage.getItem(ACTIVE_EMBEDDING_MODEL_KEY)).toBe(
      'model-new'
    );
  });

  it('leaves the key unset when clearing source metadata fails, so the next launch retries', async () => {
    await AsyncStorage.setItem(ACTIVE_EMBEDDING_MODEL_KEY, 'model-old');
    const { store, deleteVectorStore } = makeVectorStore(CURRENT_DIM);
    const { db, runAsync } = makeDb();
    runAsync.mockRejectedValueOnce(new Error('database is locked'));

    const migrated = await migrateEmbeddingModelIfNeeded(
      store,
      db,
      'model-new',
      CURRENT_DIM
    );

    expect(migrated).toBe(true);
    expect(deleteVectorStore).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem(ACTIVE_EMBEDDING_MODEL_KEY)).toBe(
      'model-old'
    );
  });

  it('leaves a lost key unset when a dimension-incompatible wipe fails', async () => {
    const { store } = makeVectorStore(384);
    const { db, runAsync } = makeDb();
    runAsync.mockRejectedValueOnce(new Error('database is locked'));

    const migrated = await migrateEmbeddingModelIfNeeded(
      store,
      db,
      'model-new',
      CURRENT_DIM
    );

    expect(migrated).toBe(true);
    expect(await AsyncStorage.getItem(ACTIVE_EMBEDDING_MODEL_KEY)).toBeNull();
  });
});
