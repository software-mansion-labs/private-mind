import {
  BIELIK_V3_0_1_5B_QUANTIZED,
  GEMMA4_E2B_MLX_MM,
  GEMMA4_E2B_MLX_MODEL,
  GEMMA4_E2B_VULKAN_MODEL,
  QWEN3_1_7B_QUANTIZED,
} from 'react-native-executorch/legacy';
import {
  DEFAULT_MODELS,
  DEFAULT_REPETITION_PENALTY,
  MEMORY_STALL_PASS_COUNT,
  MEMORY_STALL_PASS_MS,
  getGenerationConfigForModel,
  getStartingModels,
  pickMemoryStallFallback,
  runsOnMlxDelegate,
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
});

describe('the memory stall watch', () => {
  it('gives up only on a drastic slowdown, far beyond a healthy 40 ms pass', () => {
    expect(MEMORY_STALL_PASS_MS).toBe(3_000);
    expect(MEMORY_STALL_PASS_COUNT).toBe(2);
  });

  const stallWatchOf = (modelPath: string) => {
    const { stallPassMs, stallPassCount } = getGenerationConfigForModel({
      modelName: 'Any',
      modelPath,
    }) as { stallPassMs?: number; stallPassCount?: number };
    return { stallPassMs, stallPassCount };
  };

  it('is on for the Gemma builds that run on the MLX delegate', () => {
    for (const modelPath of [GEMMA4_E2B_MLX_MODEL, GEMMA4_E2B_MLX_MM]) {
      expect(stallWatchOf(modelPath)).toEqual({
        stallPassMs: MEMORY_STALL_PASS_MS,
        stallPassCount: MEMORY_STALL_PASS_COUNT,
      });
    }
  });

  it('is on for an MLX build a catalog delivers under a newer release', () => {
    expect(
      runsOnMlxDelegate({
        modelPath:
          'https://huggingface.co/software-mansion/react-native-executorch-gemma-4/resolve/v0.11.0/e2b/mlx/gemma4_e2b_mlx_int4.pte',
      })
    ).toBe(true);
  });

  it('stays off for CPU and Vulkan builds', () => {
    for (const modelPath of [
      GEMMA4_E2B_VULKAN_MODEL,
      QWEN3_1_7B_QUANTIZED.modelSource,
      'https://example.com/models/mlx-like-name.pte',
    ]) {
      expect(stallWatchOf(modelPath)).toEqual({
        stallPassMs: undefined,
        stallPassCount: undefined,
      });
    }
  });
});

describe('the smaller model offered after a memory stall', () => {
  const catalog = DEFAULT_MODELS.map((model, index) => ({
    ...model,
    id: index + 1,
    isDownloaded: false,
  }));
  const named = (modelName: string) =>
    catalog.find((model) => model.modelName === modelName)!;
  const withDownloaded = (...names: string[]) =>
    catalog.map((model) => ({
      ...model,
      isDownloaded: names.includes(model.modelName),
    }));
  const gemma = {
    ...named('Gemma 4 - 2B'),
    modelPath: GEMMA4_E2B_MLX_MODEL,
    modelSize: 2.9,
  };

  it('suggests downloading Qwen 3 1.7B when nothing smaller is on the phone', () => {
    const fallback = pickMemoryStallFallback(gemma, catalog, false);
    expect(fallback?.modelName).toBe('Qwen 3 - 1.7B');
    expect(fallback?.isDownloaded).toBe(false);
  });

  it('prefers a smaller model that is already downloaded', () => {
    const fallback = pickMemoryStallFallback(
      gemma,
      withDownloaded('Gemma 4 - 2B', 'LFM 2.5 - 1.2B'),
      false
    );
    expect(fallback?.modelName).toBe('LFM 2.5 - 1.2B');
    expect(fallback?.isDownloaded).toBe(true);
  });

  it('never offers another Gemma build, which would stall the same way', () => {
    const gemmaVision = { ...named('Gemma 4 VL - 2B'), modelSize: 3.0 };
    const fallback = pickMemoryStallFallback(
      gemmaVision,
      withDownloaded('Gemma 4 - 2B'),
      false
    );
    expect(fallback?.family).not.toBe('Gemma 4');
  });

  it('keeps to models with vision when the question carries a photo', () => {
    const fallback = pickMemoryStallFallback(
      gemma,
      withDownloaded('Qwen 3 - 1.7B'),
      true
    );
    expect(fallback?.modelName).toBe('LFM 2.5 VL - 1.6B');
  });

  it('offers nothing when no candidate is lighter', () => {
    const tiny = { ...named('Qwen 3 - 0.6B'), family: 'Other', modelSize: 0.1 };
    expect(pickMemoryStallFallback(tiny, catalog, false)).toBeUndefined();
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
