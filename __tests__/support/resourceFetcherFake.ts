import {
  ResourceFetcher,
  RnExecutorchError,
  RnExecutorchErrorCode,
} from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';

type ProgressListener = (progress: number) => void;

interface ActiveDownload {
  resolve: (paths: string[]) => void;
  reject: (error: unknown) => void;
  report: ProgressListener;
}

export interface FakeResourceFetcher {
  activeSources: () => string[];
  awaitingSizeLookup: () => number;
  releaseSizeLookups: () => Promise<void>;
  reportProgress: (source: string, progress: number) => void;
  finish: (source: string, paths?: string[]) => Promise<void>;
}

export const flushMicrotasks = () =>
  new Promise<void>((resolve) => setImmediate(resolve));

export const installFakeResourceFetcher = (): FakeResourceFetcher => {
  const active = new Map<string, ActiveDownload>();
  const sizeLookups: (() => void)[] = [];

  (ResourceFetcher.fetch as jest.Mock).mockImplementation(
    async (report: ProgressListener, ...sources: string[]) => {
      await new Promise<void>((resolve) => sizeLookups.push(resolve));

      const source = sources[0]!;
      if (active.has(source)) {
        throw new RnExecutorchError(
          RnExecutorchErrorCode.ResourceFetcherDownloadInProgress,
          'Already downloading this file'
        );
      }

      return new Promise<string[]>((resolve, reject) => {
        active.set(source, { resolve, reject, report });
      });
    }
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

  return {
    activeSources: () => [...active.keys()],
    awaitingSizeLookup: () => sizeLookups.length,
    releaseSizeLookups: async () => {
      while (sizeLookups.length > 0) sizeLookups.shift()!();
      await flushMicrotasks();
    },
    reportProgress: (source, progress) => active.get(source)?.report(progress),
    finish: async (source, paths = ['/local/model.pte']) => {
      const download = active.get(source);
      if (!download) return;
      active.delete(source);
      download.resolve(paths);
      await flushMicrotasks();
    },
  };
};
