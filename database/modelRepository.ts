import { type SQLiteDatabase } from 'expo-sqlite';

export type Model = {
  id: number;
  modelName: string;
  source: 'local' | 'remote' | 'built-in';
  isDownloaded: boolean;
  modelPath: string;
  tokenizerPath: string;
  tokenizerConfigPath: string;
  featured?: boolean;
  thinking?: boolean;
  labels?: string[];
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
      modelSize,
      featured,
      thinking,
      labels
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      model.featured ? 1 : 0,
      model.thinking ? 1 : 0,
      model.labels ? JSON.stringify(model.labels) : null,
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
  const rawModels = await db.getAllAsync<
    Omit<Model, 'isDownloaded' | 'featured' | 'thinking' | 'labels'> & {
      isDownloaded: number;
      featured: number;
      thinking: number;
      labels: string | null;
    }
  >(`SELECT * FROM models ORDER BY featured DESC`);

  const models: Model[] = rawModels.map((model) => ({
    ...model,
    isDownloaded: model.isDownloaded === 1,
    featured: model.featured === 1,
    thinking: model.thinking === 1,
    labels: model.labels ? JSON.parse(model.labels) : undefined,
  }));

  return models;
};

export const getDownloadedModels = async (
  db: SQLiteDatabase
): Promise<Model[]> => {
  const rawModels = await db.getAllAsync<
    Omit<Model, 'isDownloaded'> & {
      isDownloaded: number;
    }
  >(
    `
    SELECT * FROM models
    WHERE modelPath IS NOT NULL
      AND tokenizerPath IS NOT NULL
      AND tokenizerConfigPath IS NOT NULL
  `
  );

  const models: Model[] = rawModels.map((model) => ({
    ...model,
    isDownloaded: model.isDownloaded === 1,
  }));

  return models;
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
