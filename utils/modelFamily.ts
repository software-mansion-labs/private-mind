import { Model } from '../database/modelRepository';
import {
  THINKING_LABEL,
  VISION_LABEL,
  isCapabilityLabel,
} from '../constants/model-labels';

export const getModelFamily = (
  model: Pick<Model, 'modelName' | 'family'>
): string => {
  if (model.family) return model.family;
  const dashIdx = model.modelName.indexOf(' - ');
  if (dashIdx === -1) return model.modelName;
  return model.modelName.slice(0, dashIdx);
};

export interface ModelFamily {
  name: string;
  models: Model[];
}

export const groupModelsByFamily = (models: Model[]): ModelFamily[] => {
  const map = new Map<string, Model[]>();
  for (const model of models) {
    const family = getModelFamily(model);
    const existing = map.get(family);
    if (existing) {
      existing.push(model);
    } else {
      map.set(family, [model]);
    }
  }
  return Array.from(map.entries()).map(([name, familyModels]) => ({
    name,
    models: familyModels,
  }));
};

export interface DeviceModelFamily extends ModelFamily {
  runnable: boolean;
}

export const FAMILY_PRIORITY = [
  'LFM 3',
  'Gemma 4',
  'Qwen 3',
  'LFM 2.5',
  'LLaMA 3.2',
  'Qwen 2.5',
  'Bielik',
];

const familyRank = (name: string): number => {
  const index = FAMILY_PRIORITY.indexOf(name);
  return index === -1 ? FAMILY_PRIORITY.length : index;
};

export const orderFamiliesForDevice = (
  families: ModelFamily[],
  isCompatible: (model: Model) => boolean
): DeviceModelFamily[] =>
  families
    .map((family) => ({
      ...family,
      runnable: family.models.some(isCompatible),
    }))
    .sort(
      (a, b) =>
        Number(b.runnable) - Number(a.runnable) ||
        familyRank(a.name) - familyRank(b.name) ||
        a.name.localeCompare(b.name)
    );

export const familyLabels = (family: ModelFamily): string[] => {
  const labels = new Set<string>();
  if (family.models.some((m) => m.thinking)) labels.add(THINKING_LABEL);
  if (family.models.some((m) => m.vision)) labels.add(VISION_LABEL);
  for (const model of family.models) {
    for (const label of model.labels ?? []) {
      if (!isCapabilityLabel(label)) labels.add(label);
    }
  }
  return Array.from(labels);
};
