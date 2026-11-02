import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_MODELS } from '../constants/default-models';
import {
  MODEL_CATALOG_CACHE_KEY,
  MODEL_CATALOG_FETCH_TIMEOUT_MS,
  MODEL_CATALOG_STARTUP_WAIT_MS,
  MODEL_CATALOG_URL,
} from '../constants/modelCatalog';
import {
  modelCatalogManifestSchema,
  type CatalogModel,
} from './modelCatalogSchema';
import { currentAppVersion } from './appVersion';
import { resolveCatalogManifest } from './resolveCatalogEntry';

export type ModelCatalogOrigin = 'remote' | 'cache' | 'fallback';

export type { CatalogModel };

export type ResolvedModelCatalog = {
  models: CatalogModel[];
  origin: ModelCatalogOrigin;
  refreshed?: Promise<CatalogModel[] | null>;
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

const parseManifest = (
  text: string,
  appVersion: string
): CatalogModel[] | null => {
  const parsed = modelCatalogManifestSchema.safeParse(JSON.parse(text));
  return parsed.success
    ? resolveCatalogManifest(parsed.data, appVersion)
    : null;
};

const readCachedCatalog = async (
  appVersion: string
): Promise<CatalogModel[] | null> => {
  try {
    const cached = await AsyncStorage.getItem(MODEL_CATALOG_CACHE_KEY);
    return cached ? parseManifest(cached, appVersion) : null;
  } catch (error) {
    console.warn('Failed to read cached model catalog', error);
    return null;
  }
};

const fetchAndCacheCatalog = async (
  appVersion: string
): Promise<CatalogModel[] | null> => {
  try {
    const text = await fetchManifestText();
    const models = parseManifest(text, appVersion);
    if (!models) return null;
    try {
      await AsyncStorage.setItem(MODEL_CATALOG_CACHE_KEY, text);
    } catch (error) {
      console.warn('Failed to cache model catalog', error);
    }
    return models;
  } catch (error) {
    console.warn('Failed to fetch model catalog, falling back to cache', error);
    return null;
  }
};

const withinStartupBudget = <T>(work: Promise<T>): Promise<T | null> =>
  new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve(null),
      MODEL_CATALOG_STARTUP_WAIT_MS
    );
    work.then((value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });

export const resolveModelCatalog = async ({
  appVersion = currentAppVersion(),
}: { appVersion?: string } = {}): Promise<ResolvedModelCatalog> => {
  const cached = await readCachedCatalog(appVersion);
  const refresh = fetchAndCacheCatalog(appVersion);
  if (cached) {
    return { models: cached, origin: 'cache', refreshed: refresh };
  }

  const remote = await withinStartupBudget(refresh);
  if (remote) return { models: remote, origin: 'remote' };

  return { models: DEFAULT_MODELS, origin: 'fallback', refreshed: refresh };
};
