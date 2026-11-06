import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import {
  RECONNECT_SETTLE_MS,
  isConnectionLostError,
  waitUntilOnlineAndActive,
} from '../utils/downloadReconnect';

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
  addEventListener: jest.fn(),
}));

type NetListener = (state: object) => void;
type AppListener = (state: string) => void;

const offline = { isConnected: false, isInternetReachable: false };
const online = { isConnected: true, isInternetReachable: true };

let netListener: NetListener = () => {};
let appListener: AppListener = () => {};
const unsubscribeNet = jest.fn();
const removeApp = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  (NetInfo.fetch as jest.Mock).mockResolvedValue(offline);
  (NetInfo.addEventListener as jest.Mock).mockImplementation(
    (listener: NetListener) => {
      netListener = listener;
      return unsubscribeNet;
    }
  );
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    appListener = listener as AppListener;
    return { remove: removeApp };
  });
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true,
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  unsubscribeNet.mockClear();
  removeApp.mockClear();
});

const startWaiting = async (timeoutMs?: number) => {
  const result = waitUntilOnlineAndActive(timeoutMs);
  await jest.advanceTimersByTimeAsync(RECONNECT_SETTLE_MS);
  return result;
};

describe('isConnectionLostError', () => {
  it.each([
    'Software caused connection abort',
    'Unable to resolve host "huggingface.co": No address associated with hostname',
    'The network connection was lost.',
    'The Internet connection appears to be offline.',
    'stream was reset: CANCEL',
    'timeout',
  ])('recognises %p', (message) => {
    expect(isConnectionLostError(new Error(message))).toBe(true);
  });

  it.each([
    'write failed: ENOSPC (No space left on device)',
    'Download was canceled.',
    "Failed to fetch resource from 'x', status: 404",
  ])('does not mistake %p for a lost connection', (message) => {
    expect(isConnectionLostError(new Error(message))).toBe(false);
  });
});

describe('waitUntilOnlineAndActive', () => {
  it('resolves once the network comes back', async () => {
    let settled: boolean | undefined;
    const waiting = startWaiting().then((value) => (settled = value));
    await jest.advanceTimersByTimeAsync(0);
    expect(settled).toBeUndefined();

    netListener(online);
    await waiting;

    expect(settled).toBe(true);
    expect(unsubscribeNet).toHaveBeenCalled();
    expect(removeApp).toHaveBeenCalled();
  });

  it('waits for the app to come to the foreground before resuming', async () => {
    Object.defineProperty(AppState, 'currentState', {
      value: 'background',
      configurable: true,
    });
    (NetInfo.fetch as jest.Mock).mockResolvedValue(online);
    let settled: boolean | undefined;
    const waiting = startWaiting().then((value) => (settled = value));
    await jest.advanceTimersByTimeAsync(0);
    expect(settled).toBeUndefined();

    appListener('active');
    await waiting;

    expect(settled).toBe(true);
  });

  it('gives up when the network stays down', async () => {
    const waiting = startWaiting(60_000);
    await jest.advanceTimersByTimeAsync(60_000);

    await expect(waiting).resolves.toBe(false);
    expect(unsubscribeNet).toHaveBeenCalled();
  });
});
