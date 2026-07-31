import { useCallback, useEffect, useRef } from 'react';

export const SCROLL_SETTLE_STEPS = [
  { delay: 60, animated: true },
  { delay: 130, animated: true },
  { delay: 220, animated: true },
  { delay: 340, animated: false },
  { delay: 480, animated: false },
];

const SETTLE_WINDOW_MS =
  SCROLL_SETTLE_STEPS[SCROLL_SETTLE_STEPS.length - 1].delay;

const ANIMATED_WINDOW_MS = 300;

export interface ScrollSettler {
  start: () => void;
  cancel: () => void;
  resettle: () => void;
  isSettling: () => boolean;
}

export const useScrollSettler = (
  snapToEnd: (animated: boolean) => void
): ScrollSettler => {
  const snapRef = useRef(snapToEnd);
  useEffect(() => {
    snapRef.current = snapToEnd;
  }, [snapToEnd]);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedAt = useRef(0);
  const settlingUntil = useRef(0);

  const cancel = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    settlingUntil.current = 0;
  }, []);

  const isSettling = useCallback(() => Date.now() < settlingUntil.current, []);

  const start = useCallback(() => {
    cancel();
    startedAt.current = Date.now();
    settlingUntil.current = startedAt.current + SETTLE_WINDOW_MS;
    snapRef.current(true);
    SCROLL_SETTLE_STEPS.forEach(({ delay, animated }) => {
      timers.current.push(
        setTimeout(() => {
          snapRef.current(animated);
        }, delay)
      );
    });
  }, [cancel]);

  const resettle = useCallback(() => {
    if (!isSettling()) return;
    snapRef.current(Date.now() - startedAt.current < ANIMATED_WINDOW_MS);
  }, [isSettling]);

  useEffect(() => cancel, [cancel]);

  return { start, cancel, resettle, isSettling };
};
