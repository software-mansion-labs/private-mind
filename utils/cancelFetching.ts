import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher/legacy';
import { RnExecutorchErrorCode } from 'react-native-executorch/legacy';

export const CANCEL_POLL_MS = 50;
export const CANCEL_DEADLINE_MS = 30_000;

export const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const errorCode = (error: unknown): unknown =>
  typeof error === 'object' && error !== null
    ? (error as { code?: unknown }).code
    : undefined;

export const isNotFetchingYet = (error: unknown) =>
  errorCode(error) === RnExecutorchErrorCode.ResourceFetcherNotActive;

export type CancelOutcome = 'landed' | 'settled' | 'timed-out' | 'failed';

export const cancelFetchingSources = async (
  sources: readonly string[],
  isStillFetching: () => boolean
): Promise<CancelOutcome> => {
  if (sources.length === 0) return 'settled';
  const deadline = Date.now() + CANCEL_DEADLINE_MS;

  while (isStillFetching()) {
    try {
      await ExpoResourceFetcher.cancelFetching(...sources);
      return 'landed';
    } catch (error) {
      if (!isNotFetchingYet(error)) {
        console.warn('Failed to cancel download:', error);
        return 'failed';
      }
    }
    if (Date.now() > deadline) {
      console.warn(
        'Failed to cancel download: the fetcher never registered it'
      );
      return 'timed-out';
    }
    await wait(CANCEL_POLL_MS);
  }
  return 'settled';
};
