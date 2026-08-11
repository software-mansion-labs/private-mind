import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { Model } from '../database/modelRepository';
import { LOW_MEMORY_DEVICE_GB } from '../constants/web';
import {
  ANDROID_SYSTEM_RESERVE_GB,
  APP_RUNTIME_MEMORY_GB,
  IOS_JETSAM_SHARE,
  MEMORY_SAFETY_FACTOR,
  MODEL_MEMORY_OVERHEAD_GB,
  WEB_SEARCH_MEMORY_GB,
} from '../constants/device-memory';
import {
  getWebSearchMinDeviceMemoryGB,
  type ProfileTarget,
} from '../constants/model-profiles';

const getTotalMemoryGB = () =>
  DeviceInfo.getTotalMemorySync() / 1024 / 1024 / 1024;

const NON_QUANTIZED_MEMORY_MULTIPLIER = 2.5;
const QUANTIZED_MEMORY_MULTIPLIER = 1.75;

const quantizedKeywords = [
  'quantized',
  'qlora',
  'spinquant',
  '8da4w',
  'xnnpack',
];

const isModelQuantized = (model: Model): boolean => {
  const haystack = `${model.modelName} ${model.modelPath}`.toLowerCase();
  return quantizedKeywords.some((keyword) => haystack.includes(keyword));
};

export const getModelMemoryRequirement = (model: Model): number | null => {
  if (!model.parameters) {
    return null;
  }

  const isQuantized = isModelQuantized(model);
  const multiplier = isQuantized
    ? QUANTIZED_MEMORY_MULTIPLIER
    : NON_QUANTIZED_MEMORY_MULTIPLIER;

  return model.parameters * multiplier;
};

export const getAppMemoryBudgetGB = (): number => {
  const total = getTotalMemoryGB();
  return Platform.OS === 'ios'
    ? total * IOS_JETSAM_SHARE * MEMORY_SAFETY_FACTOR
    : Math.max(0, total - ANDROID_SYSTEM_RESERVE_GB);
};

const getModelBudgetGB = (): number =>
  getAppMemoryBudgetGB() - APP_RUNTIME_MEMORY_GB;

const getModelMemoryCostGB = (
  model: (Partial<Model> & { modelSize?: number }) | null | undefined
): number | null => {
  if (!model) return null;
  if (model.modelSize) return model.modelSize + MODEL_MEMORY_OVERHEAD_GB;
  return getModelMemoryRequirement(model as Model);
};

export const isModelCompatible = (model: Model): boolean => {
  const cost = getModelMemoryCostGB(model);

  if (cost === null) {
    return true;
  }

  try {
    return cost <= getModelBudgetGB();
  } catch {
    return true;
  }
};

export const getDeviceMemoryGB = (): number => {
  return getTotalMemoryGB();
};

export const isMemoryConstrained = (
  model?: { modelSize?: number } | null
): boolean => {
  try {
    const headroom = getTotalMemoryGB() - (model?.modelSize ?? 0);
    return headroom < LOW_MEMORY_DEVICE_GB;
  } catch {
    return false;
  }
};

export const hasMemoryForWebSearch = (
  model?: (ProfileTarget & Partial<Model> & { modelSize?: number }) | null
): boolean => {
  try {
    const required = getWebSearchMinDeviceMemoryGB(model);
    if (required !== undefined && getTotalMemoryGB() < required) return false;

    const cost = getModelMemoryCostGB(model);
    if (cost === null) return true;
    return cost + WEB_SEARCH_MEMORY_GB <= getModelBudgetGB();
  } catch {
    return true;
  }
};
