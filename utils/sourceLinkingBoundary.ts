import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SQLiteDatabase } from 'expo-sqlite';

const SOURCE_LINKING_BOUNDARY_KEY = 'source_linking_boundary_message_id';

let cachedBoundary = 0;

export const getSourceLinkingBoundary = (): number => cachedBoundary;

export const setSourceLinkingBoundary = (value: number): void => {
  cachedBoundary = Number.isFinite(value) ? value : 0;
};

export const initSourceLinkingBoundary = async (
  db: SQLiteDatabase
): Promise<number> => {
  try {
    const stored = await AsyncStorage.getItem(SOURCE_LINKING_BOUNDARY_KEY);
    if (stored != null) {
      setSourceLinkingBoundary(Number(stored));
      return cachedBoundary;
    }

    const row = await db.getFirstAsync<{ maxId: number | null }>(
      `SELECT MAX(id) AS maxId FROM messages`
    );
    setSourceLinkingBoundary(row?.maxId ?? 0);
    await AsyncStorage.setItem(
      SOURCE_LINKING_BOUNDARY_KEY,
      String(cachedBoundary)
    );
  } catch (error) {
    console.warn('Failed to initialize source-linking boundary', error);
    setSourceLinkingBoundary(0);
  }
  return cachedBoundary;
};
