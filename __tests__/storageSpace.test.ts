import { Paths } from 'expo-file-system';
import {
  NotEnoughStorageError,
  STORAGE_HEADROOM_BYTES,
  ensureStorageFor,
  isOutOfSpaceError,
  notEnoughStorageMessage,
  storageShortfall,
} from '../utils/storageSpace';

const GB = 1_000_000_000;

const setFreeBytes = (bytes: number | undefined) => {
  (Paths as { availableDiskSpace?: number }).availableDiskSpace = bytes;
};

afterEach(() => setFreeBytes(undefined));

describe('storageShortfall', () => {
  it('reports what is needed and what is free when the download does not fit', () => {
    setFreeBytes(0.3 * GB);

    expect(storageShortfall(1.25 * GB)).toEqual({
      neededBytes: 1.25 * GB,
      freeBytes: 0.3 * GB,
    });
  });

  it('keeps headroom so a download does not fill the disk to the last byte', () => {
    setFreeBytes(1.25 * GB + STORAGE_HEADROOM_BYTES - 1);

    expect(storageShortfall(1.25 * GB)).not.toBeNull();
  });

  it('lets a download through when it fits with headroom to spare', () => {
    setFreeBytes(5 * GB);

    expect(storageShortfall(1.25 * GB)).toBeNull();
  });

  it('does not block a download when the free space cannot be read', () => {
    setFreeBytes(undefined);

    expect(storageShortfall(1.25 * GB)).toBeNull();
  });
});

describe('ensureStorageFor', () => {
  it('throws an error that carries the shortfall', () => {
    setFreeBytes(0.1 * GB);

    expect(() => ensureStorageFor(0.58 * GB)).toThrow(NotEnoughStorageError);
  });
});

describe('isOutOfSpaceError', () => {
  it.each([
    'java.io.IOException: write failed: ENOSPC (No space left on device)',
    'No space left on device',
    'The operation couldn’t be completed. (NSFileWriteOutOfSpaceError)',
  ])('recognises %p', (message) => {
    expect(isOutOfSpaceError(new Error(message))).toBe(true);
  });

  it('recognises the pre-download check', () => {
    expect(
      isOutOfSpaceError(
        new NotEnoughStorageError({ neededBytes: GB, freeBytes: 0 })
      )
    ).toBe(true);
  });

  it.each(['network error', 'Download was canceled.', 'status: 404'])(
    'does not mistake %p for a full disk',
    (message) => {
      expect(isOutOfSpaceError(new Error(message))).toBe(false);
    }
  );
});

describe('notEnoughStorageMessage', () => {
  it('names the download and both sizes', () => {
    expect(
      notEnoughStorageMessage('LFM 3 - 1.7B', {
        neededBytes: 1.25 * GB,
        freeBytes: 0.36 * GB,
      })
    ).toBe(
      'Not enough storage for LFM 3 - 1.7B: it needs 1.25 GB and 0.36 GB is free. Free up space and try again.'
    );
  });
});
