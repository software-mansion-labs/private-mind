import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { Model } from '../database/modelRepository';
import { LOW_MEMORY_DEVICE_GB } from '../constants/web';
import { MODEL_MIN_RAM_GB } from '../constants/model-memory';
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

const RUNTIME_OVERHEAD_MULTIPLIER = 1.3;
const RUNTIME_OVERHEAD_GB = 0.5;
const USABLE_MEMORY_FRACTION = 0.8;

type CompatibilityCheckedModel = Pick<Model, 'modelName' | 'modelSize'>;

export const getModelMemoryRequirement = (
  model: CompatibilityCheckedModel
): number | null => {
  if (!model.modelSize) {
    return null;
  }

  return model.modelSize * RUNTIME_OVERHEAD_MULTIPLIER + RUNTIME_OVERHEAD_GB;
};

export const isModelCompatibleWithRam = (
  model: CompatibilityCheckedModel,
  deviceRamGB: number
): boolean => {
  const declaredMinRamGB = MODEL_MIN_RAM_GB[model.modelName];

  if (declaredMinRamGB !== undefined) {
    return deviceRamGB >= declaredMinRamGB;
  }

  const memoryRequirement = getModelMemoryRequirement(model);

  if (memoryRequirement === null) {
    return true;
  }

  return memoryRequirement <= deviceRamGB * USABLE_MEMORY_FRACTION;
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
  return getModelMemoryRequirement(model as CompatibilityCheckedModel);
};

export const isModelCompatible = (model: Model): boolean => {
  const declaredMinRamGB = MODEL_MIN_RAM_GB[model.modelName];

  if (declaredMinRamGB !== undefined) {
    return getTotalMemoryGB() >= declaredMinRamGB;
  }

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
