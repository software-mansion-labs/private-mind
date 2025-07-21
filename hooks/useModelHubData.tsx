import { useMemo } from 'react';
import { ModelState } from '../store/modelStore';
import { Model } from '../database/modelRepository';

interface UseModelHubDataParams {
  models: Model[];
  downloadStates: Record<number, { status: ModelState }>;
  search: string;
  activeFilters: Set<string>;
  groupByModel: boolean;
}

const groupModelsByPrefix = (models: Model[]) => {
  return models.reduce<Record<string, Model[]>>((acc, model) => {
    const prefix = model.modelName.split('-')[0].toLowerCase();
    if (!acc[prefix]) acc[prefix] = [];
    acc[prefix].push(model);
    return acc;
  }, {});
};

export default function useModelHubData({
  models,
  downloadStates,
  search,
  activeFilters,
  groupByModel,
}: UseModelHubDataParams) {
  const filteredModels = useMemo(() => {
    return models.filter((model) => {
      const matchesSearch = model.modelName
        .toLowerCase()
        .includes(search.toLowerCase());
      if (!matchesSearch) return false;

      if (activeFilters.has('featured') && model.source === 'built-in') {
        return model.featured;
      }
      return true;
    });
  }, [models, search, activeFilters]);

  const downloadedModels = useMemo(
    () => filteredModels.filter((m) => m.isDownloaded),
    [filteredModels]
  );

  const availableModels = useMemo(() => {
    const unsorted = filteredModels.filter((m) => !m.isDownloaded);

    return [...unsorted].sort((a, b) => {
      const aState = downloadStates[a.id]?.status;
      const bState = downloadStates[b.id]?.status;
      if (
        aState === ModelState.Downloading &&
        bState !== ModelState.Downloading
      )
        return -1;
      if (
        bState === ModelState.Downloading &&
        aState !== ModelState.Downloading
      )
        return 1;
      if (a.parameters && b.parameters && a.parameters !== b.parameters) {
        return a.parameters - b.parameters;
      }
      return a.modelName.localeCompare(b.modelName);
    });
  }, [filteredModels, downloadStates]);

  const groupedModels = useMemo(() => {
    if (!groupByModel) return null;
    return groupModelsByPrefix([...downloadedModels, ...availableModels]);
  }, [groupByModel, downloadedModels, availableModels]);

  return {
    downloadedModels,
    availableModels,
    groupedModels,
    isEmpty: filteredModels.length === 0,
  };
}
