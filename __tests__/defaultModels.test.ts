import {
  BIELIK_V3_0_1_5B_QUANTIZED,
  QWEN2_5_0_5B_QUANTIZED,
  QWEN3_1_7B_QUANTIZED,
} from 'react-native-executorch';
import {
  DEFAULT_MODELS,
  getGenerationConfigForModel,
  getStartingModels,
} from '../constants/default-models';
import { isModelCompatibleWithRam } from '../utils/modelCompatibility';

describe('getGenerationConfigForModel', () => {
  it('passes through the registry config without injecting a penalty for most models', () => {
    expect(
      getGenerationConfigForModel(QWEN3_1_7B_QUANTIZED.modelSource)
    ).toBeUndefined();
    expect(
      getGenerationConfigForModel('https://example.com/custom.pte')
    ).toBeUndefined();
  });

  // Qwen 2.5 - 0.5B and Bielik were observed looping verbatim on ordinary
  // prompts with the penalty off (issue #255) — everything else stays
  // untouched until it shows the same symptom under the same testing.
  it('overrides repetitionPenalty for the models observed looping unpenalized', () => {
    expect(
      getGenerationConfigForModel(QWEN2_5_0_5B_QUANTIZED.modelSource)
    ).toEqual({ repetitionPenalty: 1.05 });
    expect(
      getGenerationConfigForModel(BIELIK_V3_0_1_5B_QUANTIZED.modelSource)
    ).toEqual({ repetitionPenalty: 1.05 });
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
    // Qwen 3 - 1.7B and LFM 2.5 VL - 1.6B need more than 0.8 * 4GB once
    // runtime overhead is applied, so they are replaced with weaker models.
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

  it('replaces an incompatible high-end candidate with a weaker fallback', () => {
    expect(getStartingModels(6.01)).toEqual([
      'Gemma 4 - 2B',
      'Qwen 3 - 1.7B',
      'LFM 2.5 - 1.2B',
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
