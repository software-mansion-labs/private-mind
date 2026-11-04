import { type Model } from '../database/modelRepository';
import { updateSizeGB } from '../utils/modelUpdate';

const model = (id: number, overrides: Partial<Model>): Model => ({
  id,
  modelName: `Model ${id}`,
  source: 'built-in',
  isDownloaded: true,
  modelPath: '',
  tokenizerPath: '',
  tokenizerConfigPath: '',
  ...overrides,
});

describe('the size of an update', () => {
  const spinQuant = model(8, {
    modelName: 'SpinQuant',
    modelSize: 1.09,
    outdatedSources: ['old.pte'],
  });
  const qlora = model(7, { modelSize: 1.19, replacedBy: 'SpinQuant' });

  it('counts a replacement once when its retired model points to it too', () => {
    expect(updateSizeGB([spinQuant, qlora], [spinQuant, qlora])).toBeCloseTo(
      1.09
    );
  });

  it('counts nothing for a retired model whose replacement is already current', () => {
    const current = { ...spinQuant, outdatedSources: undefined };
    expect(updateSizeGB([qlora], [current, qlora])).toBe(0);
  });
});
