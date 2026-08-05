import DeviceInfo from 'react-native-device-info';
import {
  getModelMemoryRequirement,
  isModelCompatible,
  getDeviceMemoryGB,
  hasMemoryForWebSearch,
  isMemoryConstrained,
} from '../utils/modelCompatibility';
import { Model } from '../database/modelRepository';

const baseModel: Model = {
  id: 1,
  modelName: 'Llama-3.2-1B',
  source: 'remote',
  isDownloaded: false,
  modelPath: '',
  tokenizerPath: '',
  tokenizerConfigPath: '',
};

const mockGetTotalMemorySync = DeviceInfo.getTotalMemorySync as jest.Mock;

beforeEach(() => {
  mockGetTotalMemorySync.mockReturnValue(8 * 1024 * 1024 * 1024); // reset to 8GB
});

describe('getModelMemoryRequirement', () => {
  it('returns null when model has no parameters', () => {
    const model = { ...baseModel, parameters: undefined };
    expect(getModelMemoryRequirement(model)).toBeNull();
  });

  it('uses 2.5x multiplier for non-quantized models', () => {
    const model = { ...baseModel, modelName: 'Llama-3.2-1B', parameters: 1 };
    expect(getModelMemoryRequirement(model)).toBeCloseTo(2.5);
  });

  it('uses 1.75x multiplier for quantized models', () => {
    const model = {
      ...baseModel,
      modelName: 'Llama-3.2-1B-quantized',
      parameters: 1,
    };
    expect(getModelMemoryRequirement(model)).toBeCloseTo(1.75);
  });

  it('detects quantized keyword case-insensitively', () => {
    const model = {
      ...baseModel,
      modelName: 'Llama-QUANTIZED-1B',
      parameters: 2,
    };
    expect(getModelMemoryRequirement(model)).toBeCloseTo(3.5);
  });

  it('detects spinquant keyword', () => {
    const model = {
      ...baseModel,
      modelName: 'Llama-SpinQuant-1B',
      parameters: 1,
    };
    expect(getModelMemoryRequirement(model)).toBeCloseTo(1.75);
  });

  it('detects qlora keyword', () => {
    const model = { ...baseModel, modelName: 'Llama-QLoRA-1B', parameters: 1 };
    expect(getModelMemoryRequirement(model)).toBeCloseTo(1.75);
  });
});

describe('isModelCompatible', () => {
  it('returns true when model has no parameters (unknown requirement)', () => {
    const model = { ...baseModel, parameters: undefined };
    expect(isModelCompatible(model)).toBe(true);
  });

  it('returns true when memory requirement fits in device memory', () => {
    // 8GB device, 1B param non-quantized = 2.5GB required
    mockGetTotalMemorySync.mockReturnValue(8 * 1024 * 1024 * 1024);
    const model = { ...baseModel, parameters: 1 };
    expect(isModelCompatible(model)).toBe(true);
  });

  it('returns false when memory requirement exceeds device memory', () => {
    mockGetTotalMemorySync.mockReturnValue(2 * 1024 * 1024 * 1024); // 2GB device
    const model = { ...baseModel, parameters: 7, modelName: 'Llama-7B' }; // needs 17.5GB
    expect(isModelCompatible(model)).toBe(false);
  });

  it('returns true for a model within the memory limit', () => {
    // 8GB device, 2B params non-quantized = 5GB required — comfortably fits
    const model = { ...baseModel, parameters: 2, modelName: 'Llama-2B' };
    expect(isModelCompatible(model)).toBe(true);
  });

  it('returns false for a model that is slightly over the limit', () => {
    // 8GB device, 4B params non-quantized = 10GB needed
    const model = { ...baseModel, parameters: 4, modelName: 'Llama-4B' };
    expect(isModelCompatible(model)).toBe(false);
  });
});

describe('getDeviceMemoryGB', () => {
  it('returns a positive number', () => {
    expect(getDeviceMemoryGB()).toBeGreaterThan(0);
  });
});

describe('isMemoryConstrained', () => {
  const gb = (n: number) => n * 1024 * 1024 * 1024;

  it('counts the RAM left next to the loaded model, not the device total', () => {
    // The measured kill: an S24 (7.4 GB) with a 2.5 GB Gemma resident was
    // lmkd-killed as the foreground app during a parallel scrape.
    mockGetTotalMemorySync.mockReturnValue(gb(7.4));
    expect(isMemoryConstrained({ modelSize: 2.5 })).toBe(true);
    expect(isMemoryConstrained({ modelSize: 0.65 })).toBe(false);
  });

  it('falls back to the device threshold when no model is loaded', () => {
    mockGetTotalMemorySync.mockReturnValue(gb(7.4));
    expect(isMemoryConstrained(null)).toBe(false);
    mockGetTotalMemorySync.mockReturnValue(gb(5.8));
    expect(isMemoryConstrained(undefined)).toBe(true);
  });
});

describe('hasMemoryForWebSearch', () => {
  const gb = (value: number) => value * 1024 * 1024 * 1024;
  const gemma = { modelName: 'Gemma 4 - 2B', family: 'Gemma 4' };
  const qwen = { modelName: 'Qwen 3 - 0.6B', family: 'Qwen 3' };

  it('refuses a measured-heavy model on a phone below its floor', () => {
    mockGetTotalMemorySync.mockReturnValue(gb(5.5));
    expect(hasMemoryForWebSearch(gemma)).toBe(false);
  });

  it('allows the same model where the memory is there', () => {
    mockGetTotalMemorySync.mockReturnValue(gb(12));
    expect(hasMemoryForWebSearch(gemma)).toBe(true);
  });

  it('leaves models without a measured floor alone, even on a small phone', () => {
    mockGetTotalMemorySync.mockReturnValue(gb(3.7));
    expect(hasMemoryForWebSearch(qwen)).toBe(true);
  });

  it('does not disable the feature when the memory figure is unreadable', () => {
    mockGetTotalMemorySync.mockImplementation(() => {
      throw new Error('no such thing');
    });
    expect(hasMemoryForWebSearch(gemma)).toBe(true);
  });
});
