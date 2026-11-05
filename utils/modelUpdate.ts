import { type Model } from '../database/modelRepository';

export interface RetiredModelNotice {
  modelName: string;
  replacement: string;
}

export const needsUpdate = (model: Model): boolean =>
  model.isDownloaded && (model.outdatedSources?.length ?? 0) > 0;

export const modelsNeedingUpdate = (models: Model[]): Model[] =>
  models.filter(needsUpdate);

export const replacementsToDownload = (
  retired: RetiredModelNotice[],
  models: Model[]
): Model[] => {
  const wanted = new Set(retired.map((model) => model.replacement));
  return models.filter(
    (model) => wanted.has(model.modelName) && !model.isDownloaded
  );
};

export const pendingRetiredNotices = (
  retired: RetiredModelNotice[],
  models: Model[]
): RetiredModelNotice[] => {
  const waiting = new Set(
    replacementsToDownload(retired, models).map((model) => model.modelName)
  );
  return retired.filter((notice) => waiting.has(notice.replacement));
};

export const updateSizeGB = (models: Model[]): number =>
  models.reduce((total, model) => total + (model.modelSize ?? 0), 0);

export const modelsToUpdate = (
  models: Model[],
  retired: RetiredModelNotice[]
): Model[] => [
  ...modelsNeedingUpdate(models),
  ...replacementsToDownload(retired, models),
];
