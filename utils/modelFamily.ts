import { Model } from '../database/modelRepository';

export const getModelFamily = (model: Model): string => {
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
  return Array.from(map.entries()).map(([name, models]) => ({ name, models }));
};
