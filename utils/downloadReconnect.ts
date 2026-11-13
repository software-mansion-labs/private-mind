import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { isDeviceOnline } from './network';

export const MAX_RECONNECTS = 5;
export const RECONNECT_SETTLE_MS = 2_000;
export const RECONNECT_TIMEOUT_MS = 5 * 60_000;

const CONNECTION_LOST_PATTERN =
  /connection abort|connection reset|connection refused|network (is )?unreachable|unable to resolve host|failed to connect|timed? ?out|network connection was lost|internet connection appears to be offline|not connected to the internet|socket closed|unexpected end of stream|stream was reset/i;

const errorText = (error: unknown): string =>
  error instanceof Error ? `${error.name} ${error.message}` : String(error);

export const isConnectionLostError = (error: unknown) =>
  CONNECTION_LOST_PATTERN.test(errorText(error));

export const lostConnection = async (error: unknown) =>
  isConnectionLostError(error) || !(await isDeviceOnline());

const isUsable = (state: NetInfoState) =>
  state.isConnected !== false && state.isInternetReachable !== false;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const waitUntilOnlineAndActive = async (
  timeoutMs = RECONNECT_TIMEOUT_MS
): Promise<boolean> => {
  await wait(RECONNECT_SETTLE_MS);
  return new Promise((resolve) => {
    let online = false;
    let active = AppState.currentState === 'active';
    let done = false;
    const subscriptions: (() => void)[] = [];

    const unsubscribeAll = () =>
      subscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
    const finish = (result: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      unsubscribeAll();
      resolve(result);
    };
    const onNetwork = (state: NetInfoState) => {
      online = isUsable(state);
      if (online && active) finish(true);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);
    subscriptions.push(NetInfo.addEventListener(onNetwork));
    const appState = AppState.addEventListener('change', (state) => {
      active = state === 'active';
      if (online && active) finish(true);
    });
    subscriptions.push(() => appState.remove());
    if (done) unsubscribeAll();
    NetInfo.fetch().then(onNetwork, () => {});
  });
};

export class ConnectionLostError extends Error {
  constructor(cause: unknown) {
    super('The internet connection did not come back', { cause });
    this.name = 'ConnectionLostError';
  }
}

export const connectionLostMessage = (name: string) =>
  `${name} download stopped: no internet connection. Connect and try again.`;
