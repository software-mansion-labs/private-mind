import { type SQLiteDatabase } from 'expo-sqlite';

export type Model = {
  id: number;
  modelName: string;
  source: 'local' | 'remote' | 'built-in';
  isDownloaded: number;
  modelPath: string;
  tokenizerPath: string;
  tokenizerConfigPath: string;
  parameters?: number;
  modelSize?: number;
};

export const addModel = async (
  db: SQLiteDatabase,
  model: Omit<Model, 'id'>
): Promise<number> => {
  const result = await db.runAsync(
    `
    INSERT OR IGNORE INTO models (
      modelName,
      isDownloaded,
      source,
      modelPath,
      tokenizerPath,
      tokenizerConfigPath,
      parameters,
      modelSize
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      model.modelName,
      model.isDownloaded ? 1 : 0,
      model.source || 'remote',
      model.modelPath,
      model.tokenizerPath,
      model.tokenizerConfigPath,
      model.parameters || null,
      model.modelSize || null,
    ]
  );

  return result.lastInsertRowId;
};

export const updateModelDownloaded = async (
  db: SQLiteDatabase,
  id: number,
  downloadedStatus: number
) => {
  await db.runAsync(
    `
    UPDATE models
    SET isDownloaded = ?
    WHERE id = ?
  `,
    [downloadedStatus, id]
  );
};

export const removeModelFiles = async (db: SQLiteDatabase, id: number) => {
  await db.runAsync(`DELETE FROM models WHERE id = ?`, [id]);
};

export const getAllModels = async (db: SQLiteDatabase): Promise<Model[]> => {
  const models = await db.getAllAsync<Model>(`SELECT * FROM models`);
  return models;
};

export const getDownloadedModels = async (
  db: SQLiteDatabase
): Promise<Model[]> => {
  return await db.getAllAsync<Model>(
    `
    SELECT * FROM models
    WHERE modelPath IS NOT NULL
      AND tokenizerPath IS NOT NULL
      AND tokenizerConfigPath IS NOT NULL
  `
  );
};

export const updateModel = async (
  db: SQLiteDatabase,
  {
    modelId,
    tokenizerPath,
    tokenizerConfigPath,
    newModelName,
  }: {
    modelId: number;
    tokenizerPath: string;
    tokenizerConfigPath: string;
    newModelName: string;
  }
) => {
  await db.runAsync(
    `
    UPDATE models
    SET modelName = ?, tokenizerPath = ?, tokenizerConfigPath = ?
    WHERE id = ?
  `,
    [newModelName, tokenizerPath, tokenizerConfigPath, modelId]
  );
};
