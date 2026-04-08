import DeviceInfo from 'react-native-device-info';
import {
  getModelMemoryRequirement,
  isModelCompatible,
  getDeviceMemoryGB,
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
