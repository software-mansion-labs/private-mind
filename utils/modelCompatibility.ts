import DeviceInfo from 'react-native-device-info';
import { Model } from '../database/modelRepository';

const TOTAL_MEMORY_GB = DeviceInfo.getTotalMemorySync() / 1024 / 1024 / 1024; // in GB

const NON_QUANTIZED_MEMORY_MULTIPLIER = 2.5;
const QUANTIZED_MEMORY_MULTIPLIER = 1.75;

const quantizedKeywords = ['quantized', 'qlora', 'spinquant'];

const isModelQuantized = (modelName: string): boolean => {
  const lowerModelName = modelName.toLowerCase();
  return quantizedKeywords.some((keyword) => lowerModelName.includes(keyword));
};

export const getModelMemoryRequirement = (model: Model): number | null => {
  if (!model.parameters) {
    return null;
  }

  const isQuantized = isModelQuantized(model.modelName);
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

  return memoryRequirement <= TOTAL_MEMORY_GB;
};

export const getDeviceMemoryGB = (): number => {
  return TOTAL_MEMORY_GB;
};
