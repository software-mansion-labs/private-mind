import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_MODELS } from '../constants/default-models';
import {
  MODEL_CATALOG_CACHE_KEY,
  MODEL_CATALOG_FETCH_TIMEOUT_MS,
  MODEL_CATALOG_URL,
} from '../constants/modelCatalog';
import {
  modelCatalogManifestSchema,
  type CatalogModel,
} from './modelCatalogSchema';
import { resolveCatalogManifest } from './resolveCatalogEntry';

export type ModelCatalogOrigin = 'remote' | 'cache' | 'fallback';

export type ResolvedModelCatalog = {
  models: CatalogModel[];
  origin: ModelCatalogOrigin;
};

const fetchManifestText = async (): Promise<string> => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    MODEL_CATALOG_FETCH_TIMEOUT_MS
  );

  try {
    const response = await fetch(MODEL_CATALOG_URL, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Unexpected status ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
};

const parseManifest = (text: string): CatalogModel[] | null => {
  const parsed = modelCatalogManifestSchema.safeParse(JSON.parse(text));
  return parsed.success ? resolveCatalogManifest(parsed.data) : null;
};

const readCachedCatalog = async (): Promise<CatalogModel[] | null> => {
  try {
    const cached = await AsyncStorage.getItem(MODEL_CATALOG_CACHE_KEY);
    return cached ? parseManifest(cached) : null;
  } catch (error) {
    console.warn('Failed to read cached model catalog', error);
    return null;
  }
};

export const resolveModelCatalog = async (): Promise<ResolvedModelCatalog> => {
  try {
    const text = await fetchManifestText();
    const models = parseManifest(text);
    if (models) {
      try {
        await AsyncStorage.setItem(MODEL_CATALOG_CACHE_KEY, text);
      } catch (error) {
        console.warn('Failed to cache model catalog', error);
      }
      return { models, origin: 'remote' };
    }
  } catch (error) {
    console.warn('Failed to fetch model catalog, falling back to cache', error);
  }

  const cached = await readCachedCatalog();
  if (cached) {
    return { models: cached, origin: 'cache' };
  }

  return { models: DEFAULT_MODELS, origin: 'fallback' };
};
