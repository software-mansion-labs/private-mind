import { z } from 'zod';
import legacyCatalog from '../catalog/model-catalog.json';
import catalog from '../catalog/model-catalog-v2.json';
import rne011Catalog from '../catalog/model-catalog-v3.json';
import { DEFAULT_MODELS } from '../constants/default-models';
import {
  modelCatalogEntrySchema,
  modelCatalogManifestSchema,
} from '../utils/modelCatalogSchema';

const legacyManifestSchema = z.object({
  schemaVersion: z.literal(1),
  models: z.array(modelCatalogEntrySchema.omit({ minAppVersion: true })).min(1),
});

const names = (manifest: { models: { modelName: string }[] }) =>
  manifest.models.map((m) => m.modelName);

describe('catalog/model-catalog-v2.json', () => {
  it('matches the manifest schema', () => {
    expect(modelCatalogManifestSchema.safeParse(catalog).success).toBe(true);
  });

  it('has no duplicate model names', () => {
    expect(new Set(names(catalog)).size).toBe(names(catalog).length);
  });

  it('carries every model of the legacy catalog', () => {
    expect(names(catalog)).toEqual(
      expect.arrayContaining(names(legacyCatalog))
    );
  });

  it('gates every model the legacy catalog does not list behind a minimum app version', () => {
    const legacyNames = new Set(names(legacyCatalog));
    const onlyHere = catalog.models.filter(
      (m) => !legacyNames.has(m.modelName)
    );

    for (const model of onlyHere) {
      expect(model).toHaveProperty('minAppVersion');
    }
  });
});

describe('catalog/model-catalog.json (apps up to 1.3.4)', () => {
  it('stays on schema version 1 and lists no gated model', () => {
    expect(legacyManifestSchema.safeParse(legacyCatalog).success).toBe(true);
  });

  it('has no duplicate model names', () => {
    expect(new Set(names(legacyCatalog)).size).toBe(
      names(legacyCatalog).length
    );
  });
});

const AWAITING_RNE_0_11_EXPORT = [
  'LLaMA 3.2 - 1B - QLoRa',
  'LLaMA 3.2 - 3B - QLoRa',
];

const pathsOf = (model: (typeof rne011Catalog.models)[number]) =>
  [model.modelPath, model.tokenizerPath, model.tokenizerConfigPath].flatMap(
    (path) => (typeof path === 'string' ? [path] : Object.values(path))
  );

describe('catalog/model-catalog-v3.json (apps on the RNE 0.11 runner)', () => {
  it('matches the manifest schema', () => {
    expect(modelCatalogManifestSchema.safeParse(rne011Catalog).success).toBe(
      true
    );
  });

  it('lists the same models as the catalog for apps on /legacy', () => {
    expect(names(rne011Catalog)).toEqual(names(catalog));
  });

  it('points every model the runner can load at an export newer than v0.9', () => {
    const preSchemaExport = /\/resolve\/v0\.(8|9)\.0\//;
    const stuckOnOldExport = rne011Catalog.models
      .filter((model) => pathsOf(model).some((p) => preSchemaExport.test(p)))
      .map((model) => model.modelName);

    expect(stuckOnOldExport).toEqual(AWAITING_RNE_0_11_EXPORT);
  });

  it('downloads the same files as the catalog built into the app', () => {
    const iosPath = (path: string | { ios: string }) =>
      typeof path === 'string' ? path : path.ios;
    const builtIn = new Map(DEFAULT_MODELS.map((m) => [m.modelName, m]));
    const onRunner = rne011Catalog.models.filter(
      (model) => !AWAITING_RNE_0_11_EXPORT.includes(model.modelName)
    );

    for (const model of onRunner) {
      expect(builtIn.get(model.modelName)).toMatchObject({
        modelPath: iosPath(model.modelPath),
        tokenizerPath: iosPath(model.tokenizerPath),
        tokenizerConfigPath: iosPath(model.tokenizerConfigPath),
      });
    }
  });
});
