import { Platform } from 'react-native';
import { isVersionAtLeast } from './appVersion';
import {
  type CatalogModel,
  type ModelCatalogEntry,
  type ModelCatalogManifest,
} from './modelCatalogSchema';

const resolvePerPlatform = <T>(value: T | { ios: T; android: T }): T =>
  typeof value === 'object' && value !== null && 'ios' in value
    ? value[Platform.OS === 'android' ? 'android' : 'ios']
    : (value as T);

export const resolveCatalogEntry = (
  entry: ModelCatalogEntry
): CatalogModel => ({
  ...entry,
  modelPath: resolvePerPlatform(entry.modelPath),
  tokenizerPath: resolvePerPlatform(entry.tokenizerPath),
  tokenizerConfigPath: resolvePerPlatform(entry.tokenizerConfigPath),
  modelSize:
    entry.modelSize === undefined
      ? undefined
      : resolvePerPlatform(entry.modelSize),
});

const runsOnAppVersion = (entry: ModelCatalogEntry, appVersion: string) =>
  entry.minAppVersion === undefined ||
  isVersionAtLeast(appVersion, entry.minAppVersion);

export const resolveCatalogManifest = (
  manifest: ModelCatalogManifest,
  appVersion: string
): CatalogModel[] =>
  manifest.models
    .filter((entry) => runsOnAppVersion(entry, appVersion))
    .map(resolveCatalogEntry);
