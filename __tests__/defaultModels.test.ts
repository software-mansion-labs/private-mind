import { QWEN3_1_7B_QUANTIZED } from 'react-native-executorch';
import {
  DEFAULT_REPETITION_PENALTY,
  getGenerationConfigForModel,
  getStartingModels,
} from '../constants/default-models';

describe('getGenerationConfigForModel', () => {
  it('applies a default repetitionPenalty so no model is left without one', () => {
    // The Qwen 3 registry entry (the issue #255 model) ships no penalty.
    expect(
      getGenerationConfigForModel(QWEN3_1_7B_QUANTIZED.modelSource)
        .repetitionPenalty
    ).toBe(DEFAULT_REPETITION_PENALTY);
    // Even a model absent from the registry map gets the default.
    expect(
      getGenerationConfigForModel('https://example.com/custom.pte')
        .repetitionPenalty
    ).toBe(DEFAULT_REPETITION_PENALTY);
  });
});

describe('getStartingModels', () => {
  it('returns low-end model suggestions below 4 GB RAM', () => {
    expect(getStartingModels(3.99)).toEqual([
      'Qwen 3 - 0.6B',
      'LFM 2.5 VL - 450M',
      'LFM 2.5 - 1.2B',
    ]);
  });

  it('returns mid-range model suggestions from 4 GB to 6 GB RAM', () => {
    expect(getStartingModels(4)).toEqual([
      'Qwen 3 - 1.7B',
      'LFM 2.5 - 1.2B',
      'LFM 2.5 VL - 1.6B',
    ]);
    expect(getStartingModels(6)).toEqual([
      'Qwen 3 - 1.7B',
      'LFM 2.5 - 1.2B',
      'LFM 2.5 VL - 1.6B',
    ]);
  });

  it('returns high-end model suggestions above 6 GB RAM', () => {
    expect(getStartingModels(6.01)).toEqual([
      'Gemma 4 - 2B',
      'Gemma 4 VL - 2B',
      'Qwen 3 - 1.7B',
    ]);
  });

  it('falls back to low-end suggestions when RAM detection fails or is zero', () => {
    const lowEnd = ['Qwen 3 - 0.6B', 'LFM 2.5 VL - 450M', 'LFM 2.5 - 1.2B'];
    expect(getStartingModels(0)).toEqual(lowEnd);
    expect(getStartingModels(-1)).toEqual(lowEnd);
  });
});
