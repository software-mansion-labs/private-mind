import { useSyncExternalStore } from 'react';

let finished = false;
const listeners = new Set<() => void>();

export const markSplashFinished = (): void => {
  finished = true;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useSplashFinished = (): boolean =>
  useSyncExternalStore(subscribe, () => finished);
