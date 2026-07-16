import AsyncStorage from '@react-native-async-storage/async-storage';
import { type SQLiteDatabase } from 'expo-sqlite';
import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import { ACTIVE_EMBEDDING_MODEL_KEY } from '../constants/embedding-model';

export const migrateEmbeddingModelIfNeeded = async (
  vectorStore: OPSQLiteVectorStore,
  db: SQLiteDatabase,
  currentModelId: string
): Promise<boolean> => {
  const storedModelId = await AsyncStorage.getItem(ACTIVE_EMBEDDING_MODEL_KEY);

  if (storedModelId === currentModelId) return false;

  await vectorStore.deleteVectorStore();

  try {
    await db.runAsync(`DELETE FROM chatSources`);
    await db.runAsync(`DELETE FROM sources`);
  } catch (error) {
    console.warn(
      'Failed to clear source metadata during embedding migration',
      error
    );
  }

  await AsyncStorage.setItem(ACTIVE_EMBEDDING_MODEL_KEY, currentModelId);
  return true;
};
