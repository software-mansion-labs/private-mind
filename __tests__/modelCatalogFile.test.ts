import catalog from '../catalog/model-catalog.json';
import { modelCatalogManifestSchema } from '../utils/modelCatalogSchema';

describe('catalog/model-catalog.json', () => {
  it('matches the manifest schema', () => {
    const result = modelCatalogManifestSchema.safeParse(catalog);

    expect(result.success).toBe(true);
  });

  it('has no duplicate model names', () => {
    const names = catalog.models.map((m) => m.modelName);

    expect(new Set(names).size).toBe(names.length);
  });
});
