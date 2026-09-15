import catalog from '../catalog/model-catalog.json';
import { modelCatalogManifestSchema } from '../utils/modelCatalogSchema';

describe('catalog/model-catalog.json', () => {
  it('matches the manifest schema', () => {
    const result = modelCatalogManifestSchema.safeParse(catalog);

    expect(result.success).toBe(true);
  });

  it('never runs a vision model on the Android Vulkan backend', () => {
    const androidPath = (path: string | { android: string }) =>
      typeof path === 'string' ? path : path.android;

    const visionOnVulkan = catalog.models
      .filter((m) => m.vision && androidPath(m.modelPath).includes('/vulkan/'))
      .map((m) => m.modelName);

    expect(visionOnVulkan).toEqual([]);
  });

  it('has no duplicate model names', () => {
    const names = catalog.models.map((m) => m.modelName);

    expect(new Set(names).size).toBe(names.length);
  });
});
