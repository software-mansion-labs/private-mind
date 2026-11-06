import { Paths } from 'expo-file-system';
import Toast from 'react-native-toast-message';

const BYTES_PER_GB = 1_000_000_000;

export const STORAGE_HEADROOM_BYTES = 200_000_000;

const OUT_OF_SPACE_PATTERN =
  /NotEnoughStorageError|ENOSPC|no space left|not enough (free )?space|out of space|disk (is )?full|NSFileWriteOutOfSpaceError|storage (is )?full/i;

export interface StorageShortfall {
  neededBytes: number;
  freeBytes: number;
}

export class NotEnoughStorageError extends Error {
  constructor(readonly shortfall: StorageShortfall) {
    super('Not enough free storage for this download');
    this.name = 'NotEnoughStorageError';
  }
}

const readFreeBytes = (): number | undefined => {
  try {
    const free = Paths.availableDiskSpace;
    return Number.isFinite(free) && free >= 0 ? free : undefined;
  } catch {
    return undefined;
  }
};

export const storageShortfall = (
  neededBytes: number
): StorageShortfall | null => {
  const freeBytes = readFreeBytes();
  if (freeBytes === undefined || neededBytes <= 0) return null;
  if (freeBytes >= neededBytes + STORAGE_HEADROOM_BYTES) return null;
  return { neededBytes, freeBytes };
};

const errorText = (error: unknown): string => {
  if (error instanceof Error) {
    const cause = (error as { cause?: unknown }).cause;
    return `${error.name} ${error.message} ${cause ? errorText(cause) : ''}`;
  }
  return String(error);
};

export const isOutOfSpaceError = (error: unknown) =>
  OUT_OF_SPACE_PATTERN.test(errorText(error));

export const ensureStorageFor = (neededBytes: number) => {
  const shortfall = storageShortfall(neededBytes);
  if (shortfall) throw new NotEnoughStorageError(shortfall);
};

export const shortfallBehind = (
  error: unknown,
  neededBytes: number
): StorageShortfall | undefined => {
  if (error instanceof NotEnoughStorageError) return error.shortfall;
  const freeBytes = readFreeBytes();
  return freeBytes === undefined ? undefined : { neededBytes, freeBytes };
};

const formatGb = (bytes: number) => (bytes / BYTES_PER_GB).toFixed(2);

export const notEnoughStorageMessage = (
  name: string,
  shortfall?: StorageShortfall
) =>
  shortfall
    ? `Not enough storage for ${name}: it needs ${formatGb(shortfall.neededBytes)} GB and ${formatGb(shortfall.freeBytes)} GB is free. Free up space and try again.`
    : `${name} could not be downloaded because this device is out of storage. Free up space and try again.`;

export const showNotEnoughStorage = (
  name: string,
  shortfall?: StorageShortfall,
  onRetry?: () => void
) =>
  Toast.show({
    type: 'defaultToast',
    text1: notEnoughStorageMessage(name, shortfall),
    props: onRetry ? { onRetry } : undefined,
  });
