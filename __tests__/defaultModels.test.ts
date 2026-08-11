import {
  BIELIK_V3_0_1_5B_QUANTIZED,
  QWEN3_1_7B_QUANTIZED,
} from 'react-native-executorch';
import {
  DEFAULT_MODELS,
  DEFAULT_REPETITION_PENALTY,
  getGenerationConfigForModel,
  getStartingModels,
} from '../constants/default-models';

describe('getGenerationConfigForModel', () => {
  it('applies the profile repetitionPenalty, which defaults to none', () => {
    expect(
      getGenerationConfigForModel({
        modelName: 'Qwen 3 - 1.7B',
        family: 'Qwen 3',
        modelPath: QWEN3_1_7B_QUANTIZED.modelSource,
      }).repetitionPenalty
    ).toBe(DEFAULT_REPETITION_PENALTY);
    expect(
      getGenerationConfigForModel({
        modelName: 'Custom',
        modelPath: 'https://example.com/custom.pte',
      }).repetitionPenalty
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

describe('DEFAULT_MODELS paths', () => {
  it('sources Bielik paths from the react-native-executorch constant', () => {
    const bielik = DEFAULT_MODELS.find((m) => m.modelName === 'Bielik - v3.0');
    expect(bielik).toBeDefined();
    expect(bielik!.modelPath).toBe(BIELIK_V3_0_1_5B_QUANTIZED.modelSource);
    expect(bielik!.tokenizerPath).toBe(
      BIELIK_V3_0_1_5B_QUANTIZED.tokenizerSource
    );
    expect(bielik!.tokenizerConfigPath).toBe(
      BIELIK_V3_0_1_5B_QUANTIZED.tokenizerConfigSource
    );
  });

  it('never points a default model at the mutable HF main branch', () => {
    for (const model of DEFAULT_MODELS) {
      for (const path of [
        model.modelPath,
        model.tokenizerPath,
        model.tokenizerConfigPath,
      ]) {
        expect(path).not.toContain('/resolve/main/');
      }
    }
  });
});
