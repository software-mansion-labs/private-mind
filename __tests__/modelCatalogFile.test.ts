import { z } from 'zod';
import legacyCatalog from '../catalog/model-catalog.json';
import catalog from '../catalog/model-catalog-v2.json';
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
