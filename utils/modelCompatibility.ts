import DeviceInfo from 'react-native-device-info';
import { Model } from '../database/modelRepository';
import { MODEL_MIN_RAM_GB } from '../constants/model-memory';

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

export const isModelCompatible = (model: Model): boolean =>
  isModelCompatibleWithRam(model, getTotalMemoryGB());

export const getDeviceMemoryGB = (): number => {
  return getTotalMemoryGB();
};
