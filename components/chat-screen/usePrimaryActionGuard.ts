import { useCallback, useEffect, useRef } from 'react';

export type PrimaryAction = 'send' | 'stop' | 'voice';

const REPEAT_PRESS_MS = 500;
const SWAP_SETTLE_MS = 250;

export const usePrimaryActionGuard = (action: PrimaryAction) => {
  const settledAt = useRef(0);
  const acceptedAt = useRef(0);
  const previousAction = useRef<PrimaryAction | null>(null);

  useEffect(() => {
    if (previousAction.current === null || previousAction.current === action) {
      previousAction.current = action;
      return;
    }
    if (Date.now() - acceptedAt.current < REPEAT_PRESS_MS) {
      settledAt.current = Date.now();
    }
    acceptedAt.current = 0;
    previousAction.current = action;
  }, [action]);

  return useCallback((press: () => void) => {
    const now = Date.now();
    if (now - acceptedAt.current < REPEAT_PRESS_MS) return;
    if (now - settledAt.current < SWAP_SETTLE_MS) return;
    acceptedAt.current = now;
    press();
  }, []);
};
