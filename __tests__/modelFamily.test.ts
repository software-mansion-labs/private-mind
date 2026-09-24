import {
  getModelFamily,
  groupModelsByFamily,
  orderFamiliesForDevice,
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
      makeModel({
        id: 1,
        modelName: 'LFM 2.5 - 1.2B - Quantized',
        family: 'LFM 2.5',
      }),
      makeModel({
        id: 2,
        modelName: 'LFM 2.5 VL - 450M - Quantized',
        family: 'LFM 2.5',
      }),
      makeModel({
        id: 3,
        modelName: 'Qwen 3 - 0.6B - Quantized',
        family: 'Qwen 3',
      }),
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
    expect(families).toEqual([{ name: 'Foo', models: [models[0], models[1]] }]);
  });
});

describe('orderFamiliesForDevice', () => {
  const fits = (model: Model) => (model.modelSize ?? 0) <= 2;

  it('marks a family runnable when any variant fits, and only then', () => {
    const [partial, deadEnd] = orderFamiliesForDevice(
      [
        {
          name: 'Qwen 2.5',
          models: [
            makeModel({ modelName: 'Qwen 2.5 - 0.5B', modelSize: 0.8 }),
            makeModel({ modelName: 'Qwen 2.5 - 3B', modelSize: 2.9 }),
          ],
        },
        {
          name: 'Gemma 4',
          models: [
            makeModel({ modelName: 'Gemma 4 - 2B', modelSize: 2.9 }),
            makeModel({ modelName: 'Gemma 4 VL - 2B', modelSize: 4 }),
          ],
        },
      ],
      fits
    );
    expect(partial).toMatchObject({ name: 'Qwen 2.5', runnable: true });
    expect(deadEnd).toMatchObject({ name: 'Gemma 4', runnable: false });
  });

  it('lists the families the device can run first, each group by name', () => {
    const names = orderFamiliesForDevice(
      [
        { name: 'Gemma 4', models: [makeModel({ modelSize: 4 })] },
        { name: 'Qwen 3', models: [makeModel({ modelSize: 1 })] },
        { name: 'Bielik', models: [makeModel({ modelSize: 3 })] },
        { name: 'LFM 2.5', models: [makeModel({ modelSize: 1 })] },
      ],
      fits
    ).map((family) => family.name);
    expect(names).toEqual(['LFM 2.5', 'Qwen 3', 'Bielik', 'Gemma 4']);
  });

  it('treats an empty family as a dead end rather than crashing', () => {
    expect(
      orderFamiliesForDevice([{ name: 'Empty', models: [] }], fits)[0]
    ).toMatchObject({ runnable: false });
  });
});
