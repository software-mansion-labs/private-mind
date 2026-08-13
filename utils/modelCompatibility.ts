import DeviceInfo from 'react-native-device-info';
import { Model } from '../database/modelRepository';
import { MODEL_MIN_RAM_GB } from '../constants/model-memory';

const getTotalMemoryGB = () =>
  DeviceInfo.getTotalMemorySync() / 1024 / 1024 / 1024;

const RUNTIME_OVERHEAD_MULTIPLIER = 1.3;
const RUNTIME_OVERHEAD_GB = 0.5;
const USABLE_MEMORY_FRACTION = 0.8;

export const getModelMemoryRequirement = (model: Model): number | null => {
  if (!model.modelSize) {
    return null;
  }

  return model.modelSize * RUNTIME_OVERHEAD_MULTIPLIER + RUNTIME_OVERHEAD_GB;
};

export const isModelCompatible = (model: Model): boolean => {
  const declaredMinRamGB = MODEL_MIN_RAM_GB[model.modelName];

  if (declaredMinRamGB !== undefined) {
    return getTotalMemoryGB() >= declaredMinRamGB;
  }

  const memoryRequirement = getModelMemoryRequirement(model);

  if (memoryRequirement === null) {
    return true;
  }

  return memoryRequirement <= getTotalMemoryGB() * USABLE_MEMORY_FRACTION;
};

export const getDeviceMemoryGB = (): number => {
  return getTotalMemoryGB();
};
