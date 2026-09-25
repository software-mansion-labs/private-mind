import { useCallback, useEffect, useRef } from 'react';

export type PrimaryAction = 'send' | 'stop' | 'voice';

const ACTION_SETTLE_MS = 500;

export const usePrimaryActionGuard = (action: PrimaryAction) => {
  const settledAt = useRef(0);
  const lastPressAt = useRef(0);
  const previousAction = useRef<PrimaryAction | null>(null);

  useEffect(() => {
    const swappedUnderOwnPress =
      previousAction.current !== null &&
      previousAction.current !== action &&
      Date.now() - lastPressAt.current < ACTION_SETTLE_MS;
    if (swappedUnderOwnPress) {
      settledAt.current = Date.now();
    }
    previousAction.current = action;
  }, [action]);

  return useCallback((press: () => void) => {
    const now = Date.now();
    const sinceLastPress = now - lastPressAt.current;
    lastPressAt.current = now;
    if (sinceLastPress < ACTION_SETTLE_MS) return;
    if (now - settledAt.current < ACTION_SETTLE_MS) return;
    press();
  }, []);
};
