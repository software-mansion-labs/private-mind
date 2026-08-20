const mockFetch = jest.fn();

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: (...args: unknown[]) => mockFetch(...args) },
}));

import { isDeviceOnline } from '../utils/network';

describe('isDeviceOnline', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns true when NetInfo reports connectivity', async () => {
    mockFetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
    expect(await isDeviceOnline()).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('fails open (treats as online) when NetInfo throws', async () => {
    mockFetch.mockRejectedValue(new Error('native module unavailable'));
    expect(await isDeviceOnline()).toBe(true);
  });

  it('retries once and recovers from a transient offline blip', async () => {
    jest.useFakeTimers();
    try {
      mockFetch
        .mockResolvedValueOnce({
          isConnected: false,
          isInternetReachable: false,
        })
        .mockResolvedValueOnce({
          isConnected: true,
          isInternetReachable: true,
        });

      const resultPromise = isDeviceOnline();
      await jest.advanceTimersByTimeAsync(1000);

      expect(await resultPromise).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('reports offline when both checks agree there is no connectivity', async () => {
    jest.useFakeTimers();
    try {
      mockFetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });

      const resultPromise = isDeviceOnline();
      await jest.advanceTimersByTimeAsync(1000);

      expect(await resultPromise).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('treats an unknown isInternetReachable as online', async () => {
    mockFetch.mockResolvedValue({
      isConnected: false,
      isInternetReachable: null,
    });
    expect(await isDeviceOnline()).toBe(true);
  });
});
