import { type SQLiteDatabase } from 'expo-sqlite';
import { DEFAULT_MODELS, startingModels } from '../constants/default-models';

export type Model = {
  id: number;
  modelName: string;
  source: 'local' | 'remote' | 'built-in';
  isDownloaded: boolean;
  modelPath: string;
  tokenizerPath: string;
  tokenizerConfigPath: string;
  family?: string;
  featured?: boolean;
  experimental?: boolean;
  thinking?: boolean;
  vision?: boolean;
  labels?: string[];
  parameters?: number;
  modelSize?: number;
  systemPrompt?: string | null;
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
      family,
      parameters,
      modelSize,
      featured,
      experimental,
      thinking,
      vision,
      labels,
      systemPrompt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      model.modelName,
      model.isDownloaded ? 1 : 0,
      model.source || 'remote',
      model.modelPath,
      model.tokenizerPath,
      model.tokenizerConfigPath,
      model.family || null,
      model.parameters || null,
      model.modelSize || null,
      model.featured ? 1 : 0,
      model.experimental ? 1 : 0,
      model.thinking ? 1 : 0,
      model.vision ? 1 : 0,
      model.labels ? JSON.stringify(model.labels) : null,
      model.systemPrompt || null,
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

type RawModel = Omit<
  Model,
  | 'isDownloaded'
  | 'featured'
  | 'experimental'
  | 'thinking'
  | 'vision'
  | 'labels'
> & {
  isDownloaded: number;
  featured: number;
  experimental: number;
  thinking: number;
  vision: number;
  labels: string | null;
  systemPrompt: string | null;
};

const parseLabels = (raw: string | null): string[] | undefined => {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const hydrateModel = (model: RawModel): Model => {
  const defaults =
    model.source === 'built-in'
      ? DEFAULT_MODELS.find((m) => m.modelName === model.modelName)
      : undefined;

  return {
    ...model,
    modelPath: defaults?.modelPath ?? model.modelPath,
    tokenizerPath: defaults?.tokenizerPath ?? model.tokenizerPath,
    tokenizerConfigPath:
      defaults?.tokenizerConfigPath ?? model.tokenizerConfigPath,
    family: defaults?.family ?? model.family ?? undefined,
    isDownloaded: model.isDownloaded === 1,
    featured: model.featured === 1,
    experimental: model.experimental === 1,
    thinking: model.thinking === 1,
    vision: model.vision === 1,
    labels: parseLabels(model.labels),
    systemPrompt: model.systemPrompt ?? null,
  };
};

export const getAllModels = async (db: SQLiteDatabase): Promise<Model[]> => {
  const rawModels = await db.getAllAsync<RawModel>(
    `SELECT * FROM models ORDER BY featured DESC`
  );
  return rawModels.map(hydrateModel);
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

export const getStartingModels = async (db: SQLiteDatabase) => {
  const placeholders = startingModels.map(() => '?').join(', ');
  const rawModels = await db.getAllAsync<RawModel>(
    `SELECT * FROM models WHERE modelName IN (${placeholders})`,
    startingModels
  );
  return rawModels.map(hydrateModel);
};
