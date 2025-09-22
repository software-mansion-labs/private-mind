import { useMemo } from 'react';
import { Model } from '../database/modelRepository';
import { isModelCompatible } from '../utils/modelCompatibility';

export enum ModelHubFilter {
  Featured = 'featured',
  Downloaded = 'downloaded',
  Compatible = 'compatible',
}

interface UseModelHubDataParams {
  models: Model[];
  search: string;
  activeFilters: Set<ModelHubFilter>;
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

      const matchesFeatured =
        model.featured ||
        model.source !== 'built-in' ||
        !activeFilters.has(ModelHubFilter.Featured);
      if (!matchesFeatured) return false;

      const matchesDownloaded =
        model.isDownloaded || !activeFilters.has(ModelHubFilter.Downloaded);
      if (!matchesDownloaded) return false;

      const matchesCompatible =
        isModelCompatible(model) || !activeFilters.has(ModelHubFilter.Compatible);
      if (!matchesCompatible) return false;

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
      if (a.parameters && b.parameters && a.parameters !== b.parameters) {
        return a.parameters - b.parameters;
      }
      return a.modelName.localeCompare(b.modelName);
    });
  }, [filteredModels]);

  const groupedModels = useMemo(() => {
    return groupByModel
      ? Object.entries(
          groupModelsByPrefix([...downloadedModels, ...availableModels])
        ).map(([label, models]) => ({ label, models }))
      : [
          { label: 'Ready to Use', models: downloadedModels },
          { label: 'Available to Download', models: availableModels },
        ];
  }, [groupByModel, downloadedModels, availableModels]);

  return {
    groupedModels,
    isEmpty: filteredModels.length === 0,
  };
}
