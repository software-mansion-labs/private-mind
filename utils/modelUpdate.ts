import { type Model } from '../database/modelRepository';

export const needsUpdate = (model: Model): boolean =>
  model.isDownloaded &&
  ((model.outdatedSources?.length ?? 0) > 0 || !!model.replacedBy);

export const modelsNeedingUpdate = (models: Model[]): Model[] =>
  models.filter(needsUpdate);

const downloadFor = (model: Model, models: Model[]): Model | undefined => {
  if (!model.replacedBy) return model;
  const replacement = models.find((m) => m.modelName === model.replacedBy);
  if (!replacement) return undefined;
  return replacement.isDownloaded && !needsUpdate(replacement)
    ? undefined
    : replacement;
};

export const updateSizeGB = (outdated: Model[], models: Model[]): number => {
  const downloads = new Map<number, Model>();
  for (const model of outdated) {
    const target = downloadFor(model, models);
    if (target) downloads.set(target.id, target);
  }
  return [...downloads.values()].reduce(
    (total, model) => total + (model.modelSize ?? 0),
    0
  );
};
