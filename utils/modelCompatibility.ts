import DeviceInfo from 'react-native-device-info';
import { Model } from '../database/modelRepository';

const TOTAL_MEMORY_GB = DeviceInfo.getTotalMemorySync() / 1024 / 1024 / 1024; // in GB

/**
 * Memory multiplier for non-quantized models
 */
const NON_QUANTIZED_MEMORY_MULTIPLIER = 2.5;

/**
 * Memory multiplier for quantized models (they use less memory)
 */
const QUANTIZED_MEMORY_MULTIPLIER = 1.75;

/**
 * Checks if a model name indicates it's quantized by looking for common quantization keywords
 */
const isModelQuantized = (modelName: string): boolean => {
  const quantizedKeywords = ['quantized', 'qlora', 'spinquant'];
  const lowerModelName = modelName.toLowerCase();
  return quantizedKeywords.some(keyword => lowerModelName.includes(keyword));
};

/**
 * Calculates the estimated memory requirement for a model in GB
 */
export const getModelMemoryRequirement = (model: Model): number | null => {
  if (!model.parameters) {
    return null;
  }

  const isQuantized = isModelQuantized(model.modelName);
  const multiplier = isQuantized ? QUANTIZED_MEMORY_MULTIPLIER : NON_QUANTIZED_MEMORY_MULTIPLIER;

  return model.parameters * multiplier;
};

/**
 * Checks if a model is compatible with the current device based on memory requirements
 */
export const isModelCompatible = (model: Model): boolean => {
  const memoryRequirement = getModelMemoryRequirement(model);

  // If we can't determine memory requirement, assume it's compatible
  if (memoryRequirement === null) {
    return true;
  }

  return memoryRequirement <= TOTAL_MEMORY_GB;
};

/**
 * Gets the device's total memory in GB
 */
export const getDeviceMemoryGB = (): number => {
  return TOTAL_MEMORY_GB;
};