import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher/legacy';
import {
  RnExecutorchError,
  RnExecutorchErrorCode,
} from 'react-native-executorch/legacy';
import {
  CANCEL_DEADLINE_MS,
  cancelFetchingSources,
} from '../utils/cancelFetching';

const cancelFetching = ExpoResourceFetcher.cancelFetching as jest.Mock;

const notActiveYet = () =>
  new RnExecutorchError(
    RnExecutorchErrorCode.ResourceFetcherNotActive,
    'None of given sources are currently during downloading process.'
  );

const SOURCES = ['https://host/model.pte', 'https://host/tokenizer.json'];

beforeEach(() => {
  jest.useFakeTimers();
  cancelFetching.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('cancelFetchingSources', () => {
  it('keeps retrying until the fetcher registers the download, then cancels it', async () => {
    cancelFetching
      .mockRejectedValueOnce(notActiveYet())
      .mockRejectedValueOnce(notActiveYet())
      .mockResolvedValueOnce(undefined);

    const outcome = cancelFetchingSources(SOURCES, () => true);
    await jest.advanceTimersByTimeAsync(1_000);

    await expect(outcome).resolves.toBe('landed');
    expect(cancelFetching).toHaveBeenCalledTimes(3);
    expect(cancelFetching).toHaveBeenLastCalledWith(...SOURCES);
  });

  it('stops retrying once the fetch has settled on its own', async () => {
    let fetching = true;
    cancelFetching.mockImplementation(async () => {
      fetching = false;
      throw notActiveYet();
    });

    const outcome = cancelFetchingSources(SOURCES, () => fetching);
    await jest.advanceTimersByTimeAsync(1_000);

    await expect(outcome).resolves.toBe('settled');
    expect(cancelFetching).toHaveBeenCalledTimes(1);
  });

  it('gives up after the deadline when the fetcher never registers the download', async () => {
    cancelFetching.mockRejectedValue(notActiveYet());

    const outcome = cancelFetchingSources(SOURCES, () => true);
    await jest.advanceTimersByTimeAsync(CANCEL_DEADLINE_MS + 1_000);

    await expect(outcome).resolves.toBe('timed-out');
  });

  it('does not retry an error other than the fetcher not being active yet', async () => {
    cancelFetching.mockRejectedValue(new Error('boom'));

    const outcome = cancelFetchingSources(SOURCES, () => true);
    await jest.advanceTimersByTimeAsync(1_000);

    await expect(outcome).resolves.toBe('failed');
    expect(cancelFetching).toHaveBeenCalledTimes(1);
  });

  it('does not call the fetcher when nothing is downloading', async () => {
    await expect(cancelFetchingSources(SOURCES, () => false)).resolves.toBe(
      'settled'
    );
    expect(cancelFetching).not.toHaveBeenCalled();
  });
});
