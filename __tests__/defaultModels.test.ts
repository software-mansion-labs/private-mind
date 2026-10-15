import {
  BIELIK_V3_0_1_5B_QUANTIZED,
  QWEN3_1_7B_QUANTIZED,
} from 'react-native-executorch/legacy';
import {
  DEFAULT_MODELS,
  DEFAULT_REPETITION_PENALTY,
  RUNNER_DEFAULT_SAMPLING,
  getGenerationConfigForModel,
  getStartingModels,
} from '../constants/default-models';
import { isModelCompatibleWithRam } from '../utils/modelCompatibility';

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

  it.each(DEFAULT_MODELS.map((model) => [model.modelName, model] as const))(
    'states every sampling setting for %s, so a configure() leaves nothing of the previous one behind',
    (_name, model) => {
      const config = getGenerationConfigForModel(model);
      for (const key of [
        'temperature',
        'topP',
        'minP',
        'repetitionPenalty',
      ] as const) {
        expect(typeof config[key]).toBe('number');
      }
    }
  );

  it('gives a model the catalogue sets no sampling for the sampling the runner loads with', () => {
    const bielik = DEFAULT_MODELS.find(
      (model) => model.modelPath === BIELIK_V3_0_1_5B_QUANTIZED.modelSource
    )!;
    expect(getGenerationConfigForModel(bielik)).toEqual({
      ...RUNNER_DEFAULT_SAMPLING,
      repetitionPenalty: DEFAULT_REPETITION_PENALTY,
    });
    expect(RUNNER_DEFAULT_SAMPLING).toEqual({
      temperature: 0.8,
      topP: 0.9,
      minP: 0,
    });
  });
});

describe('getStartingModels', () => {
  it('always returns low-end model suggestions below 4 GB RAM', () => {
    expect(getStartingModels(3.99)).toEqual([
      'Qwen 3 - 0.6B',
      'LFM 2.5 VL - 450M',
      'LFM 2.5 - 1.2B',
    ]);
    expect(getStartingModels(0)).toEqual([
      'Qwen 3 - 0.6B',
      'LFM 2.5 VL - 450M',
      'LFM 2.5 - 1.2B',
    ]);
  });

  it('replaces incompatible mid-range candidates with low-end fallbacks', () => {
    expect(getStartingModels(4)).toEqual([
      'LFM 2.5 - 1.2B',
      'Qwen 3 - 0.6B',
      'LFM 2.5 VL - 450M',
    ]);
    expect(getStartingModels(6)).toEqual([
      'Qwen 3 - 1.7B',
      'LFM 2.5 - 1.2B',
      'LFM 2.5 VL - 1.6B',
    ]);
  });

  it('offers the large models only where the device budget covers them', () => {
    expect(getStartingModels(7.6)).toEqual([
      'Gemma 4 - 2B',
      'Gemma 4 VL - 2B',
      'Qwen 3 - 1.7B',
    ]);
  });

  it('drops a 6 GB phone down to what it can actually hold', () => {
    expect(getStartingModels(5.4959)).toEqual([
      'Qwen 3 - 1.7B',
      'LFM 2.5 - 1.2B',
      'Qwen 3 - 0.6B',
    ]);
  });

  it('only recommends compatible models when RAM is at least 4 GB', () => {
    for (let ramGB = 4; ramGB <= 12; ramGB += 0.5) {
      const recommended = getStartingModels(ramGB);
      for (const modelName of recommended) {
        const model = DEFAULT_MODELS.find((m) => m.modelName === modelName)!;
        expect(isModelCompatibleWithRam(model, ramGB)).toBe(true);
      }
    }
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
