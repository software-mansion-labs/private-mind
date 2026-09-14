import { DEFAULT_MODELS } from '../constants/default-models';
import { type CatalogModel } from './modelCatalogSchema';

let activeCatalog: CatalogModel[] = DEFAULT_MODELS;

export const getActiveCatalog = (): CatalogModel[] => activeCatalog;

export const setActiveCatalog = (models: CatalogModel[]): void => {
  activeCatalog = models;
};
