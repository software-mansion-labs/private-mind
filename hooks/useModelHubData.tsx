import { useMemo } from 'react';
import { ModelState } from '../store/modelStore';
import { Model } from '../database/modelRepository';

export enum ModelHubFilter {
  Featured = 'featured',
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

      if (activeFilters.has(ModelHubFilter.Featured) && model.source === 'built-in') {
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
