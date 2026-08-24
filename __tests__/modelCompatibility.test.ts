import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import {
  getModelMemoryRequirement,
  isModelCompatible,
  getDeviceMemoryGB,
  getAppMemoryBudgetGB,
  hasMemoryForWebSearch,
  isMemoryConstrained,
  isHighMemoryDevice,
} from '../utils/modelCompatibility';
import { Model } from '../database/modelRepository';

const setPlatform = (os: string) => {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
};
const ORIGINAL_OS = Platform.OS;
afterEach(() => setPlatform(ORIGINAL_OS));

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
const gb = (value: number) => value * 1024 * 1024 * 1024;

beforeEach(() => {
  mockGetTotalMemorySync.mockReturnValue(gb(8));
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
  it('returns true when nothing about the model says how big it is', () => {
    const model = { ...baseModel, modelSize: undefined };
    expect(isModelCompatible(model)).toBe(true);
  });

  it('does not hide every model when the memory figure is unreadable', () => {
    mockGetTotalMemorySync.mockImplementation(() => {
      throw new Error('no such thing');
    });
    expect(isModelCompatible({ ...baseModel, modelSize: 2.5 })).toBe(true);
  });

  it('blocks Gemma 4 VL on a 6GB device', () => {
    mockGetTotalMemorySync.mockReturnValue(gb(5.5));
    const gemma4VL = {
      ...baseModel,
      modelName: 'Gemma 4 VL - 2B',
      modelSize: 4.0,
    };
    expect(isModelCompatible(gemma4VL)).toBe(false);
  });

  it('keeps Gemma 4 VL available on an 8GB device', () => {
    mockGetTotalMemorySync.mockReturnValue(gb(7.5));
    const gemma4VL = {
      ...baseModel,
      modelName: 'Gemma 4 VL - 2B',
      modelSize: 4.0,
    };
    expect(isModelCompatible(gemma4VL)).toBe(true);
  });

  it('lets a declared minimum override a size that would otherwise pass', () => {
    mockGetTotalMemorySync.mockReturnValue(gb(5.5));
    const shrunkGemma4VL = {
      ...baseModel,
      modelName: 'Gemma 4 VL - 2B',
      modelSize: 1.0,
    };
    expect(isModelCompatible(shrunkGemma4VL)).toBe(false);
  });

  it('honours a declared minimum on a device that meets it', () => {
    mockGetTotalMemorySync.mockReturnValue(gb(7.5));
    const gemma4VL = {
      ...baseModel,
      modelName: 'Gemma 4 VL - 2B',
      modelSize: 4.0,
    };
    expect(isModelCompatible(gemma4VL)).toBe(true);
  });

  it('blocks a model that cannot fit on a small device', () => {
    mockGetTotalMemorySync.mockReturnValue(gb(2));
    const model = { ...baseModel, modelName: 'Llama-7B', modelSize: 6.8 };
    expect(isModelCompatible(model)).toBe(false);
  });
});

describe('what each device is allowed to run', () => {
  const CATALOGUE = [
    { modelName: 'LFM 2.5 VL - 450M', family: 'LFM', modelSize: 0.65 },
    { modelName: 'Qwen 2.5 - 0.5B', family: 'Qwen 2.5', modelSize: 0.81 },
    { modelName: 'Qwen 3 - 0.6B', family: 'Qwen 3', modelSize: 0.94 },
    {
      modelName: 'LLaMA 3.2 - 1B - SpinQuant',
      family: 'LLaMA',
      modelSize: 1.14,
    },
    { modelName: 'LFM 2.5 - 1.2B', family: 'LFM', modelSize: 1.14 },
    { modelName: 'Qwen 2.5 - 1.5B', family: 'Qwen 2.5', modelSize: 1.76 },
    { modelName: 'Qwen 3 - 1.7B', family: 'Qwen 3', modelSize: 2.16 },
    { modelName: 'LFM 2.5 VL - 1.6B', family: 'LFM', modelSize: 2.43 },
    { modelName: 'Gemma 4 - 2B', family: 'Gemma 4', modelSize: 2.5 },
    { modelName: 'Qwen 2.5 - 3B', family: 'Qwen 2.5', modelSize: 2.89 },
    { modelName: 'Gemma 4 VL - 2B', family: 'Gemma 4', modelSize: 4.0 },
  ];

  const allowed = (totalGB: number, os: string) => {
    setPlatform(os);
    mockGetTotalMemorySync.mockReturnValue(gb(totalGB));
    return CATALOGUE.filter((model) =>
      isModelCompatible(model as unknown as Model)
    ).map((model) => model.modelName);
  };

  const withSearch = (totalGB: number, os: string) => {
    setPlatform(os);
    mockGetTotalMemorySync.mockReturnValue(gb(totalGB));
    return CATALOGUE.filter(
      (model) =>
        isModelCompatible(model as unknown as Model) &&
        hasMemoryForWebSearch(model)
    ).map((model) => model.modelName);
  };

  it('iPhone SE, 4 GB — jetsam killed the app at 2.29 GiB here', () => {
    expect(allowed(3.8, 'ios')).toEqual([
      'LFM 2.5 VL - 450M',
      'Qwen 2.5 - 0.5B',
      'Qwen 3 - 0.6B',
      'LLaMA 3.2 - 1B - SpinQuant',
      'LFM 2.5 - 1.2B',
    ]);
    expect(withSearch(3.8, 'ios')).toEqual([
      'LFM 2.5 VL - 450M',
      'Qwen 2.5 - 0.5B',
      'Qwen 3 - 0.6B',
    ]);
  });

  it('Galaxy S20 FE, 6 GB — four foreground low-memory kills here', () => {
    expect(allowed(5.49, 'android')).toEqual([
      'LFM 2.5 VL - 450M',
      'Qwen 2.5 - 0.5B',
      'Qwen 3 - 0.6B',
      'LLaMA 3.2 - 1B - SpinQuant',
      'LFM 2.5 - 1.2B',
      'Qwen 2.5 - 1.5B',
      'Qwen 3 - 1.7B',
    ]);
    expect(withSearch(5.49, 'android')).toEqual([
      'LFM 2.5 VL - 450M',
      'Qwen 2.5 - 0.5B',
      'Qwen 3 - 0.6B',
      'LLaMA 3.2 - 1B - SpinQuant',
      'LFM 2.5 - 1.2B',
      'Qwen 2.5 - 1.5B',
    ]);
  });

  it('8 GB Android — keeps every model it can run today', () => {
    expect(allowed(7.4, 'android')).toEqual(CATALOGUE.map((m) => m.modelName));
  });

  it('12 GB Android — every model, and search alongside all but the measured refusals', () => {
    expect(allowed(11.1, 'android')).toEqual(CATALOGUE.map((m) => m.modelName));
    expect(withSearch(11.1, 'android')).toEqual(
      CATALOGUE.map((m) => m.modelName)
    );
  });
});

describe('getAppMemoryBudgetGB', () => {
  it('is a share of RAM on iOS, where the cap is per process', () => {
    setPlatform('ios');
    mockGetTotalMemorySync.mockReturnValue(gb(3.8));
    expect(getAppMemoryBudgetGB()).toBeLessThan(2.29);
  });

  it('is RAM minus what the system needs on Android, where nothing caps a process', () => {
    setPlatform('android');
    mockGetTotalMemorySync.mockReturnValue(gb(5.49));
    expect(getAppMemoryBudgetGB()).toBeCloseTo(2.99, 2);
  });
});

describe('getDeviceMemoryGB', () => {
  it('returns a positive number', () => {
    expect(getDeviceMemoryGB()).toBeGreaterThan(0);
  });
});

describe('isMemoryConstrained', () => {
  it('counts the RAM left next to the loaded model, not the device total', () => {
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

describe('isHighMemoryDevice', () => {
  it('counts the RAM left next to the loaded model, not the device total', () => {
    mockGetTotalMemorySync.mockReturnValue(gb(13));
    expect(isHighMemoryDevice({ modelSize: 2 })).toBe(true);
    expect(isHighMemoryDevice({ modelSize: 6 })).toBe(false);
  });

  it('falls back to the device threshold when no model is loaded', () => {
    mockGetTotalMemorySync.mockReturnValue(gb(12));
    expect(isHighMemoryDevice(null)).toBe(true);
    mockGetTotalMemorySync.mockReturnValue(gb(6));
    expect(isHighMemoryDevice(undefined)).toBe(false);
  });

  it('does not force the download when the memory figure is unreadable', () => {
    mockGetTotalMemorySync.mockImplementation(() => {
      throw new Error('no such thing');
    });
    expect(isHighMemoryDevice({ modelSize: 2 })).toBe(false);
  });
});
