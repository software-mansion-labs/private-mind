import type { Model } from '../../database/modelRepository';
import { isModelCompatible } from '../modelCompatibility';

const BYTES_PER_GB = 1024 ** 3;
const DOWNLOAD_SIZE_MARGIN = 1.1;
const FREE_SPACE_RESERVE_BYTES = BYTES_PER_GB;

const sizeRank = (model: Model): number =>
  model.modelSize ?? model.parameters ?? Number.MAX_VALUE;

export const smallestFirst = (a: Model, b: Model): number =>
  sizeRank(a) - sizeRank(b) || a.modelName.localeCompare(b.modelName);

const isOnDeviceOrDownloadable = (model: Model): boolean =>
  model.isDownloaded || model.source !== 'local';

export const benchmarkableModels = (
  models: Model[],
  runsOnThisDevice: (model: Model) => boolean = isModelCompatible
): Model[] =>
  models
    .filter(
      (model) => isOnDeviceOrDownloadable(model) && runsOnThisDevice(model)
    )
    .sort(smallestFirst);

export const bytesNeededToDownload = (model: Model): number | null =>
  model.modelSize
    ? model.modelSize * BYTES_PER_GB * DOWNLOAD_SIZE_MARGIN +
      FREE_SPACE_RESERVE_BYTES
    : null;

export const noRoomToDownload = (
  model: Model,
  freeBytes: number
): string | null => {
  const needed = bytesNeededToDownload(model);
  if (needed === null || freeBytes >= needed) return null;
  const toGB = (bytes: number) => (bytes / BYTES_PER_GB).toFixed(1);
  return `needs ${toGB(needed)} GB free, ${toGB(freeBytes)} GB left`;
};
