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

const GB = 1024 * 1024 * 1024;
const GALAXY_S20_FE_BYTES = 5763304 * 1024;
const EIGHT_GB_PHONE_BYTES = 7.5 * GB;

const mockGetTotalMemorySync = DeviceInfo.getTotalMemorySync as jest.Mock;

beforeEach(() => {
  mockGetTotalMemorySync.mockReturnValue(8 * GB);
});

describe('getModelMemoryRequirement', () => {
  it('returns null when the model has no known download size', () => {
    const model = { ...baseModel, modelSize: undefined };
    expect(getModelMemoryRequirement(model)).toBeNull();
  });

  it('derives the requirement from the on-disk size', () => {
    const model = { ...baseModel, modelSize: 2 };
    expect(getModelMemoryRequirement(model)).toBeCloseTo(3.1);
  });

  it('ignores the parameter count when a size is known', () => {
    const twoBillionParams = { ...baseModel, parameters: 2, modelSize: 4 };
    const halfBillionParams = { ...baseModel, parameters: 0.5, modelSize: 4 };
    expect(getModelMemoryRequirement(twoBillionParams)).toBeCloseTo(
      getModelMemoryRequirement(halfBillionParams)!
    );
  });
});

describe('isModelCompatible', () => {
  it('returns true when the size is unknown', () => {
    const model = { ...baseModel, modelSize: undefined };
    expect(isModelCompatible(model)).toBe(true);
  });

  it('blocks Gemma 4 VL on a 6GB device', () => {
    mockGetTotalMemorySync.mockReturnValue(GALAXY_S20_FE_BYTES);
    const gemma4VL = {
      ...baseModel,
      modelName: 'Gemma 4 VL - 2B',
      parameters: 2,
      modelSize: 4.0,
    };
    expect(isModelCompatible(gemma4VL)).toBe(false);
  });

  it('keeps Gemma 4 VL available on an 8GB device', () => {
    mockGetTotalMemorySync.mockReturnValue(EIGHT_GB_PHONE_BYTES);
    const gemma4VL = {
      ...baseModel,
      modelName: 'Gemma 4 VL - 2B',
      parameters: 2,
      modelSize: 4.0,
    };
    expect(isModelCompatible(gemma4VL)).toBe(true);
  });

  it('keeps the 6GB starting tier available on a 6GB device', () => {
    mockGetTotalMemorySync.mockReturnValue(GALAXY_S20_FE_BYTES);
    const qwen3 = { ...baseModel, modelName: 'Qwen 3 - 1.7B', modelSize: 2.16 };
    const lfm = { ...baseModel, modelName: 'LFM 2.5 - 1.2B', modelSize: 1.14 };
    const lfmVL = {
      ...baseModel,
      modelName: 'LFM 2.5 VL - 1.6B',
      modelSize: 2.43,
    };

    expect(isModelCompatible(qwen3)).toBe(true);
    expect(isModelCompatible(lfm)).toBe(true);
    expect(isModelCompatible(lfmVL)).toBe(true);
  });

  it('keeps Gemma 4 text available on a 6GB device', () => {
    mockGetTotalMemorySync.mockReturnValue(GALAXY_S20_FE_BYTES);
    const gemma4 = { ...baseModel, modelName: 'Gemma 4 - 2B', modelSize: 2.5 };
    expect(isModelCompatible(gemma4)).toBe(true);
  });

  it('blocks a model that cannot fit on a small device', () => {
    mockGetTotalMemorySync.mockReturnValue(2 * GB);
    const model = { ...baseModel, modelName: 'Llama-7B', modelSize: 6.8 };
    expect(isModelCompatible(model)).toBe(false);
  });
});

describe('getDeviceMemoryGB', () => {
  it('returns a positive number', () => {
    expect(getDeviceMemoryGB()).toBeGreaterThan(0);
  });
});
