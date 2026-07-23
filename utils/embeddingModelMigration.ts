import AsyncStorage from '@react-native-async-storage/async-storage';
import { type SQLiteDatabase } from 'expo-sqlite';
import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import { ACTIVE_EMBEDDING_MODEL_KEY } from '../constants/embedding-model';

const readPersistedVectorDim = async (
  vectorStore: OPSQLiteVectorStore
): Promise<number | null> => {
  try {
    const result = await vectorStore.db.execute(
      `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'vectors'`
    );
    const createSql = result.rows[0]?.sql as string | undefined;
    const match = createSql?.match(/F32_BLOB\((\d+)\)/i);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
};

const clearImportedSources = async (
  vectorStore: OPSQLiteVectorStore,
  db: SQLiteDatabase
): Promise<boolean> => {
  await vectorStore.deleteVectorStore();
  try {
    await db.runAsync(`DELETE FROM chatSources`);
    await db.runAsync(`DELETE FROM sources`);
    return true;
  } catch (error) {
    console.warn(
      'Failed to clear source metadata during embedding migration',
      error
    );
    return false;
  }
};

export const migrateEmbeddingModelIfNeeded = async (
  vectorStore: OPSQLiteVectorStore,
  db: SQLiteDatabase,
  currentModelId: string,
  currentModelDim: number
): Promise<boolean> => {
  const storedModelId = await AsyncStorage.getItem(ACTIVE_EMBEDDING_MODEL_KEY);

  if (storedModelId === currentModelId) return false;

  if (storedModelId === null) {
    const persistedDim = await readPersistedVectorDim(vectorStore);
    const incompatible =
      persistedDim !== null && persistedDim !== currentModelDim;
    if (incompatible && !(await clearImportedSources(vectorStore, db))) {
      return true;
    }
    await AsyncStorage.setItem(ACTIVE_EMBEDDING_MODEL_KEY, currentModelId);
    return incompatible;
  }

  if (!(await clearImportedSources(vectorStore, db))) return true;
  await AsyncStorage.setItem(ACTIVE_EMBEDDING_MODEL_KEY, currentModelId);
  return true;
};
