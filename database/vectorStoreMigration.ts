import type { SQLiteDatabase } from 'expo-sqlite';

// Drops the legacy pre-RAG `vectors` table and its orphaned sources. The
// sqlite_master guard is load-bearing: vectors moved to a separate op-sqlite db,
// so without it the catch below would wipe sources on every launch.
export const migrateLegacyVectorStore = async (
  db: SQLiteDatabase
): Promise<void> => {
  const hasLegacyVectorsTable = await db.getFirstAsync(
    `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'vectors'`
  );
  if (!hasLegacyVectorsTable) return;

  try {
    await db.execAsync(`SELECT document FROM vectors LIMIT 0`);
  } catch {
    await db.execAsync(`DROP TABLE IF EXISTS vectors`);
    await db.runAsync(`DELETE FROM chatSources`);
    await db.runAsync(`DELETE FROM sources`);
  }
};
