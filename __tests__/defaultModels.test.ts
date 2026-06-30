import { getStartingModels } from '../constants/default-models';

describe('getStartingModels', () => {
  it('returns low-end model suggestions below 4 GB RAM', () => {
    expect(getStartingModels(3.99)).toEqual([
      'Qwen 3 - 0.6B',
      'Qwen 2.5 - 0.5B',
      'LFM 2.5 VL - 450M',
    ]);
  });

  it('returns mid-range model suggestions from 4 GB to 6 GB RAM', () => {
    expect(getStartingModels(4)).toEqual([
      'LFM 2.5 - 1.2B',
      'LLaMA 3.2 - 1B - SpinQuant',
      'Qwen 3 - 1.7B',
    ]);
    expect(getStartingModels(6)).toEqual([
      'LFM 2.5 - 1.2B',
      'LLaMA 3.2 - 1B - SpinQuant',
      'Qwen 3 - 1.7B',
    ]);
  });

  it('returns high-end model suggestions above 6 GB RAM', () => {
    expect(getStartingModels(6.01)).toEqual([
      'Gemma 4 VL - 2B',
      'Qwen 2.5 - 3B',
      'LLaMA 3.2 - 3B - SpinQuant',
    ]);
  });
});
