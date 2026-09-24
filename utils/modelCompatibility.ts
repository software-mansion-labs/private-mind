import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { Model } from '../database/modelRepository';
import {
  LOW_MEMORY_DEVICE_GB,
  LOW_MEMORY_DEVICE_IOS_GB,
  STRONG_DEVICE_MEMORY_GB,
} from '../constants/web';
import { MODEL_MIN_RAM_GB } from '../constants/model-memory';
import {
  ANDROID_SYSTEM_RESERVE_GB,
  ANDROID_SYSTEM_RESERVE_SHARE,
  APP_RUNTIME_MEMORY_GB,
  DECLARED_FLOOR_TIGHT_MARGIN_GB,
  IOS_JETSAM_SHARE,
  MEMORY_SAFETY_FACTOR,
  MODEL_MEMORY_OVERHEAD_GB,
  TIGHT_FIT_BUDGET_SHARE,
  WEB_SEARCH_MEMORY_GB,
} from '../constants/device-memory';
import {
  getWebSearchMinDeviceMemoryGB,
  type ProfileTarget,
} from '../constants/model-profiles';

const getTotalMemoryGB = () =>
  DeviceInfo.getTotalMemorySync() / 1024 / 1024 / 1024;

const nominalDeviceMemoryGB = () => Math.ceil(getTotalMemoryGB());

const RUNTIME_OVERHEAD_MULTIPLIER = 1.3;
const RUNTIME_OVERHEAD_GB = 0.5;

type CompatibilityCheckedModel = Pick<Model, 'modelName' | 'modelSize'>;

export const getModelMemoryRequirement = (
  model: CompatibilityCheckedModel
): number | null => {
  if (!model.modelSize) {
    return null;
  }

  return model.modelSize * RUNTIME_OVERHEAD_MULTIPLIER + RUNTIME_OVERHEAD_GB;
};

const androidSystemReserveGB = (totalGB: number): number =>
  Math.min(ANDROID_SYSTEM_RESERVE_GB, totalGB * ANDROID_SYSTEM_RESERVE_SHARE);

export const appMemoryBudgetFromTotalGB = (totalGB: number): number =>
  Platform.OS === 'ios'
    ? totalGB * IOS_JETSAM_SHARE * MEMORY_SAFETY_FACTOR
    : Math.max(0, totalGB - androidSystemReserveGB(totalGB));

export const getAppMemoryBudgetGB = (): number =>
  appMemoryBudgetFromTotalGB(getTotalMemoryGB());

const modelBudgetFromTotalGB = (totalGB: number): number =>
  appMemoryBudgetFromTotalGB(totalGB) - APP_RUNTIME_MEMORY_GB;

const getModelBudgetGB = (): number =>
  modelBudgetFromTotalGB(getTotalMemoryGB());

const getModelMemoryCostGB = (
  model: (Partial<Model> & { modelSize?: number }) | null | undefined
): number | null => {
  if (!model) return null;
  if (model.modelSize) return model.modelSize + MODEL_MEMORY_OVERHEAD_GB;
  return getModelMemoryRequirement(model as CompatibilityCheckedModel);
};

export type ModelRiskTier = 'ok' | 'tight' | 'unsafe';

export type ModelRiskReason =
  | 'fits'
  | 'little-headroom'
  | 'over-budget'
  | 'below-declared-floor'
  | 'unknown-size';

export type ModelRisk = {
  readonly tier: ModelRiskTier;
  readonly reason: ModelRiskReason;
};

const FITS: ModelRisk = { tier: 'ok', reason: 'fits' };

const riskAgainstDeclaredFloor = (
  totalGB: number,
  declaredMinRamGB: number
): ModelRisk => {
  const nominalGB = Math.ceil(totalGB);
  if (nominalGB < declaredMinRamGB) {
    return { tier: 'unsafe', reason: 'below-declared-floor' };
  }
  if (nominalGB <= declaredMinRamGB + DECLARED_FLOOR_TIGHT_MARGIN_GB) {
    return { tier: 'tight', reason: 'little-headroom' };
  }
  return FITS;
};

const riskAgainstBudget = (
  cost: number | null,
  modelBudgetGB: number
): ModelRisk => {
  if (cost === null) return { tier: 'tight', reason: 'unknown-size' };
  if (cost > modelBudgetGB) return { tier: 'unsafe', reason: 'over-budget' };
  if (cost > modelBudgetGB * TIGHT_FIT_BUDGET_SHARE) {
    return { tier: 'tight', reason: 'little-headroom' };
  }
  return FITS;
};

const riskOnDeviceWithTotalGB = (
  model: CompatibilityCheckedModel,
  totalGB: number
): ModelRisk => {
  const declaredMinRamGB = MODEL_MIN_RAM_GB[model.modelName];
  if (declaredMinRamGB !== undefined) {
    return riskAgainstDeclaredFloor(totalGB, declaredMinRamGB);
  }
  return riskAgainstBudget(
    getModelMemoryCostGB(model),
    modelBudgetFromTotalGB(totalGB)
  );
};

export const getModelRisk = (model: CompatibilityCheckedModel): ModelRisk => {
  try {
    return riskOnDeviceWithTotalGB(model, getTotalMemoryGB());
  } catch {
    return FITS;
  }
};

export const getModelRiskTier = (
  model: CompatibilityCheckedModel
): ModelRiskTier => getModelRisk(model).tier;

export const isModelCompatible = (model: CompatibilityCheckedModel): boolean =>
  getModelRiskTier(model) !== 'unsafe';

export const isModelCompatibleWithRam = (
  model: CompatibilityCheckedModel,
  deviceRamGB: number
): boolean => riskOnDeviceWithTotalGB(model, deviceRamGB).tier !== 'unsafe';

export const getDeviceMemoryGB = (): number => {
  return getTotalMemoryGB();
};

const lowMemoryHeadroomGB = (): number =>
  Platform.OS === 'ios' ? LOW_MEMORY_DEVICE_IOS_GB : LOW_MEMORY_DEVICE_GB;

export const isMemoryConstrained = (
  model?: { modelSize?: number } | null
): boolean => {
  try {
    const headroom = getTotalMemoryGB() - (model?.modelSize ?? 0);
    return headroom < lowMemoryHeadroomGB();
  } catch {
    return false;
  }
};

export const isHighMemoryDevice = (
  model?: { modelSize?: number } | null
): boolean => {
  try {
    const headroom = getTotalMemoryGB() - (model?.modelSize ?? 0);
    return headroom >= STRONG_DEVICE_MEMORY_GB;
  } catch {
    return false;
  }
};

export const hasMemoryForWebSearch = (
  model?: (ProfileTarget & Partial<Model> & { modelSize?: number }) | null
): boolean => {
  try {
    const required = getWebSearchMinDeviceMemoryGB(model);
    if (required !== undefined && nominalDeviceMemoryGB() < required) {
      return false;
    }

    const cost = getModelMemoryCostGB(model);
    if (cost === null) return true;
    return cost + WEB_SEARCH_MEMORY_GB <= getModelBudgetGB();
  } catch {
    return true;
  }
};
