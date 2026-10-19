import {
  ResourceFetcher,
  RnExecutorchError,
  RnExecutorchErrorCode,
} from 'react-native-executorch/legacy';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';

type ProgressListener = (progress: number) => void;

interface ActiveDownload {
  resolve: () => void;
  reject: (error: unknown) => void;
  report: ProgressListener;
}

export interface FakeResourceFetcher {
  activeSources: () => string[];
  awaitingSizeLookup: () => number;
  releaseSizeLookups: () => Promise<void>;
  reportProgress: (source: string, progress: number) => void;
  finish: (source: string) => Promise<void>;
  fail: (source: string, error: unknown) => Promise<void>;
  finishEverything: () => Promise<void>;
  putOnDisk: (...sources: string[]) => void;
  setSize: (source: string, bytes: number) => void;
  isOnDisk: (source: string) => boolean;
  timesDownloaded: (source: string) => number;
}

export const flushMicrotasks = () =>
  new Promise<void>((resolve) => setImmediate(resolve));

const DRAIN_ROUNDS = 50;

export const installFakeResourceFetcher = (): FakeResourceFetcher => {
  const active = new Map<string, ActiveDownload>();
  const onDisk = new Set<string>();
  const downloadCounts = new Map<string, number>();
  const sizeLookups: (() => void)[] = [];
  const sizes = new Map<string, number>();

  const downloadOne = (source: string, report: ProgressListener) => {
    if (active.has(source)) {
      throw new RnExecutorchError(
        RnExecutorchErrorCode.ResourceFetcherDownloadInProgress,
        'Already downloading this file'
      );
    }
    downloadCounts.set(source, (downloadCounts.get(source) ?? 0) + 1);
    return new Promise<void>((resolve, reject) => {
      active.set(source, { resolve, reject, report });
    });
  };

  (ResourceFetcher.fetch as jest.Mock).mockImplementation(
    async (report: ProgressListener, ...sources: string[]) => {
      await new Promise<void>((resolve) => sizeLookups.push(resolve));

      for (const source of sources) {
        if (onDisk.has(source)) continue;
        await downloadOne(source, report);
        onDisk.add(source);
      }
      return { paths: sources.map((source) => `/local/${source}`) };
    }
  );

  (ExpoResourceFetcher.getFilesTotalSize as jest.Mock).mockImplementation(
    async (source: string) => sizes.get(source) ?? 0
  );

  (ExpoResourceFetcher.cancelFetching as jest.Mock).mockImplementation(
    async (...sources: string[]) => {
      const source = sources.find((candidate) => active.has(candidate));
      if (source === undefined) {
        throw new RnExecutorchError(
          RnExecutorchErrorCode.ResourceFetcherNotActive,
          'None of given sources are currently during downloading process.'
        );
      }

      const download = active.get(source)!;
      active.delete(source);
      download.reject(
        new RnExecutorchError(
          RnExecutorchErrorCode.DownloadInterrupted,
          'Download was canceled.'
        )
      );
    }
  );

  const releaseSizeLookups = async () => {
    while (sizeLookups.length > 0) sizeLookups.shift()!();
    await flushMicrotasks();
  };

  const finish = async (source: string) => {
    const download = active.get(source);
    if (!download) return;
    active.delete(source);
    download.resolve();
    await flushMicrotasks();
  };

  return {
    activeSources: () => [...active.keys()],
    awaitingSizeLookup: () => sizeLookups.length,
    releaseSizeLookups,
    reportProgress: (source, progress) => active.get(source)?.report(progress),
    finish,
    fail: async (source, error) => {
      const download = active.get(source);
      if (!download) return;
      active.delete(source);
      download.reject(error);
      await flushMicrotasks();
    },
    finishEverything: async () => {
      for (let round = 0; round < DRAIN_ROUNDS; round++) {
        await releaseSizeLookups();
        for (const source of [...active.keys()]) await finish(source);
        await flushMicrotasks();
      }
    },
    putOnDisk: (...sources) => sources.forEach((source) => onDisk.add(source)),
    setSize: (source, bytes) => sizes.set(source, bytes),
    isOnDisk: (source) => onDisk.has(source),
    timesDownloaded: (source) => downloadCounts.get(source) ?? 0,
  };
};
