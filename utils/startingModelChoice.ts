import { Model } from '../database/modelRepository';

export const keepStartingModelChoice = (
  current: Model | null,
  downloaded: Model[],
  starting: Model[]
): Model | null => {
  const isDownloaded = (model: Model) =>
    downloaded.some((candidate) => candidate.id === model.id);

  if (current && isDownloaded(current)) return current;
  return starting.find(isDownloaded) ?? downloaded[0] ?? null;
};
