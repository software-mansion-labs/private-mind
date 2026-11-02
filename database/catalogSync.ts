import { type SQLiteDatabase } from 'expo-sqlite';
import { useModelStore } from '../store/modelStore';
import {
  type CatalogModel,
  type ResolvedModelCatalog,
} from '../utils/fetchModelCatalog';
import { setActiveCatalog } from '../utils/modelCatalogState';
import { addModel } from './modelRepository';

export const updateCatalogRows = async (
  db: SQLiteDatabase,
  catalog: CatalogModel[]
): Promise<void> => {
  for (const model of catalog) {
    await db.runAsync(
      `UPDATE models SET family = ?, featured = ?, experimental = ?, thinking = ?, vision = ?, labels = ?, systemPrompt = ? WHERE modelName = ?`,
      model.family || null,
      model.featured ? 1 : 0,
      model.experimental ? 1 : 0,
      model.thinking ? 1 : 0,
      model.vision ? 1 : 0,
      model.labels ? JSON.stringify(model.labels) : null,
      model.systemPrompt || null,
      model.modelName
    );

    await db.runAsync(
      `UPDATE models SET modelPath = ?, tokenizerPath = ?, tokenizerConfigPath = ?, modelSize = ?
       WHERE modelName = ? AND source = 'built-in' AND isDownloaded = 0`,
      model.modelPath,
      model.tokenizerPath,
      model.tokenizerConfigPath,
      model.modelSize ?? null,
      model.modelName
    );
  }
};

export const insertCatalogModels = async (
  db: SQLiteDatabase,
  catalog: CatalogModel[]
): Promise<void> => {
  for (const model of catalog) {
    await addModel(db, {
      modelName: model.modelName,
      source: 'built-in',
      isDownloaded: false,
      modelPath: model.modelPath,
      tokenizerPath: model.tokenizerPath,
      tokenizerConfigPath: model.tokenizerConfigPath,
      family: model.family,
      parameters: model.parameters,
      modelSize: model.modelSize,
      featured: !!model.featured,
      experimental: !!model.experimental,
      thinking: !!model.thinking,
      vision: !!model.vision,
      labels: model.labels,
      systemPrompt: model.systemPrompt,
    });
  }
};

const isSameCatalog = (a: CatalogModel[], b: CatalogModel[]): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export const applyRefreshedCatalog = async (
  db: SQLiteDatabase,
  shown: CatalogModel[],
  refreshed: CatalogModel[]
): Promise<boolean> => {
  if (isSameCatalog(shown, refreshed)) return false;

  setActiveCatalog(refreshed);
  await db.withTransactionAsync(async () => {
    await updateCatalogRows(db, refreshed);
    await insertCatalogModels(db, refreshed);
  });
  await useModelStore.getState().loadModels();
  return true;
};

export const applyCatalogWhenItArrives = (
  db: SQLiteDatabase,
  resolved: ResolvedModelCatalog
): void => {
  resolved.refreshed
    ?.then((refreshed) =>
      refreshed ? applyRefreshedCatalog(db, resolved.models, refreshed) : false
    )
    .catch((error) => console.warn('Failed to apply refreshed catalog', error));
};
