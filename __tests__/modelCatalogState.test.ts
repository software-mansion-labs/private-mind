import { DEFAULT_MODELS } from '../constants/default-models';
import { getActiveCatalog, setActiveCatalog } from '../utils/modelCatalogState';

describe('modelCatalogState', () => {
  afterEach(() => {
    setActiveCatalog(DEFAULT_MODELS);
  });

  it('defaults to DEFAULT_MODELS before anything is resolved', () => {
    expect(getActiveCatalog()).toBe(DEFAULT_MODELS);
  });

  it('returns whatever was last set', () => {
    const custom = [{ ...DEFAULT_MODELS[0], modelName: 'Custom Model' }];

    setActiveCatalog(custom);

    expect(getActiveCatalog()).toBe(custom);
  });
});
