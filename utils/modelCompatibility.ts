import DeviceInfo from 'react-native-device-info';
import { Model } from '../database/modelRepository';
import { LOW_MEMORY_DEVICE_GB } from '../constants/web';
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

export const isModelCompatible = (model: Model): boolean => {
  const memoryRequirement = getModelMemoryRequirement(model);

  // If we can't determine memory requirement, assume it's compatible
  if (memoryRequirement === null) {
    return true;
  }

  return memoryRequirement <= getTotalMemoryGB();
};

export const getDeviceMemoryGB = (): number => {
  return getTotalMemoryGB();
};

/**
 * The search pipeline competes with the RAM left NEXT TO the loaded model, not
 * the device total: an S24 counts as roomy until a 2.5 GB model is resident and
 * lmkd shoots the app while it is foreground.
 */
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

/**
 * Searching allocates on top of the model — a WebView per page, the article
 * text, and on the semantic path a second resident model — and on a phone
 * already near its limit that is what the OS kills the app over, mid-answer.
 */
export const hasMemoryForWebSearch = (
  model?: (ProfileTarget & { modelSize?: number }) | null
): boolean => {
  const required = getWebSearchMinDeviceMemoryGB(model);
  if (required === undefined) return true;
  try {
    return getTotalMemoryGB() >= required;
  } catch {
    // An unreadable memory figure must not silently disable the feature.
    return true;
  }
};
