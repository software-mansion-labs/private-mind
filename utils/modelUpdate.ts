import { type Model } from '../database/modelRepository';

export const needsUpdate = (model: Model): boolean =>
  model.isDownloaded && (model.outdatedSources?.length ?? 0) > 0;

export const modelsNeedingUpdate = (models: Model[]): Model[] =>
  models.filter(needsUpdate);

export const updateSizeGB = (models: Model[]): number =>
  models.reduce((total, model) => total + (model.modelSize ?? 0), 0);
