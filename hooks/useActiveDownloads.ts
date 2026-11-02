import { useMemo } from 'react';
import { Model } from '../database/modelRepository';
import { ModelState, useModelStore } from '../store/modelStore';

export interface ActiveDownload {
  model: Model;
  progress: number;
  rate?: number;
}

export const useActiveDownloads = (): ActiveDownload[] => {
  const models = useModelStore((state) => state.models);
  const downloadStates = useModelStore((state) => state.downloadStates);

  return useMemo(
    () =>
      models.flatMap((model) => {
        const state = downloadStates[model.id];
        return state?.status === ModelState.Downloading
          ? [{ model, progress: state.progress, rate: state.rate }]
          : [];
      }),
    [models, downloadStates]
  );
};

export const overallProgress = (downloads: ActiveDownload[]) => {
  const totalGB = downloads.reduce(
    (sum, d) => sum + (d.model.modelSize ?? 0),
    0
  );
  if (totalGB === 0) {
    return (
      downloads.reduce((sum, d) => sum + d.progress, 0) /
      Math.max(downloads.length, 1)
    );
  }
  return (
    downloads.reduce(
      (sum, d) => sum + d.progress * (d.model.modelSize ?? 0),
      0
    ) / totalGB
  );
};
