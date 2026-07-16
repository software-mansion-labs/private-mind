import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateEmbeddingModelIfNeeded } from '../utils/embeddingModelMigration';
import { ACTIVE_EMBEDDING_MODEL_KEY } from '../constants/embedding-model';
import type { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

const makeVectorStore = () => {
  const deleteVectorStore = jest.fn().mockResolvedValue(undefined);
  return {
    store: { deleteVectorStore } as unknown as OPSQLiteVectorStore,
    deleteVectorStore,
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

    const migrated = await migrateEmbeddingModelIfNeeded(store, db, 'model-a');

    expect(migrated).toBe(false);
    expect(deleteVectorStore).not.toHaveBeenCalled();
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('adopts the current model without wiping when no model was recorded', async () => {
    const { store, deleteVectorStore } = makeVectorStore();
    const { db, runAsync } = makeDb();

    const migrated = await migrateEmbeddingModelIfNeeded(store, db, 'model-a');

    expect(migrated).toBe(false);
    expect(deleteVectorStore).not.toHaveBeenCalled();
    expect(runAsync).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(ACTIVE_EMBEDDING_MODEL_KEY)).toBe(
      'model-a'
    );
  });

  it('wipes the vector store and source metadata on a genuine model change', async () => {
    await AsyncStorage.setItem(ACTIVE_EMBEDDING_MODEL_KEY, 'model-old');
    const { store, deleteVectorStore } = makeVectorStore();
    const { db, runAsync } = makeDb();

    const migrated = await migrateEmbeddingModelIfNeeded(
      store,
      db,
      'model-new'
    );

    expect(migrated).toBe(true);
    expect(deleteVectorStore).toHaveBeenCalledTimes(1);
    expect(runAsync).toHaveBeenCalledWith('DELETE FROM chatSources');
    expect(runAsync).toHaveBeenCalledWith('DELETE FROM sources');
    expect(await AsyncStorage.getItem(ACTIVE_EMBEDDING_MODEL_KEY)).toBe(
      'model-new'
    );
  });
});
