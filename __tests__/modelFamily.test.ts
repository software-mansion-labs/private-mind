import {
  getModelFamily,
  groupModelsByFamily,
} from '../utils/modelFamily';
import { Model } from '../database/modelRepository';

const makeModel = (overrides: Partial<Model>): Model => ({
  id: 1,
  modelName: 'Test',
  source: 'built-in',
  isDownloaded: false,
  modelPath: '',
  tokenizerPath: '',
  tokenizerConfigPath: '',
  ...overrides,
});

describe('getModelFamily', () => {
  it('prefers the explicit family field', () => {
    const model = makeModel({
      modelName: 'LFM 2.5 VL - 450M - Quantized',
      family: 'LFM 2.5',
    });
    expect(getModelFamily(model)).toBe('LFM 2.5');
  });

  it('falls back to the name prefix before the first " - "', () => {
    const model = makeModel({ modelName: 'Qwen 3 - 0.6B - Quantized' });
    expect(getModelFamily(model)).toBe('Qwen 3');
  });

  it('returns the full name when there is no separator', () => {
    const model = makeModel({ modelName: 'Custom Model' });
    expect(getModelFamily(model)).toBe('Custom Model');
  });
});

describe('groupModelsByFamily', () => {
  it('merges VL and non-VL variants under a shared family', () => {
    const models = [
      makeModel({ id: 1, modelName: 'LFM 2.5 - 1.2B - Quantized', family: 'LFM 2.5' }),
      makeModel({ id: 2, modelName: 'LFM 2.5 VL - 450M - Quantized', family: 'LFM 2.5' }),
      makeModel({ id: 3, modelName: 'Qwen 3 - 0.6B - Quantized', family: 'Qwen 3' }),
    ];

    const families = groupModelsByFamily(models);

    expect(families).toHaveLength(2);
    const lfm = families.find((f) => f.name === 'LFM 2.5');
    expect(lfm?.models.map((m) => m.id)).toEqual([1, 2]);
    const qwen = families.find((f) => f.name === 'Qwen 3');
    expect(qwen?.models.map((m) => m.id)).toEqual([3]);
  });

  it('groups models without a family field by name prefix', () => {
    const models = [
      makeModel({ id: 1, modelName: 'Foo - A' }),
      makeModel({ id: 2, modelName: 'Foo - B' }),
    ];
    const families = groupModelsByFamily(models);
    expect(families).toEqual([
      { name: 'Foo', models: [models[0], models[1]] },
    ]);
  });
});
