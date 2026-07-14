import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Easing,
  runOnJS,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {
  EMPHASIZED_ACCELERATE,
  EMPHASIZED_DECELERATE,
  FIELD_FADE_IN_DELAY,
  FIELD_FADE_IN_DURATION,
  FIELD_FADE_OUT_DURATION,
  SEARCH_COLLAPSE_DURATION,
  SEARCH_EXPAND_DURATION,
} from '../../constants/drawer-layout';

const EXPAND_EASING = Easing.bezier(...EMPHASIZED_DECELERATE);
const COLLAPSE_EASING = Easing.bezier(...EMPHASIZED_ACCELERATE);
const FADE_EASING = Easing.bezier(0.33, 1, 0.68, 1);

interface Options {
  active: boolean;
  closeInstantly: boolean;
}

export const useSearchOverlayAnimation = ({
  active,
  closeInstantly,
}: Options) => {
  const [mounted, setMounted] = useState(active);
  const mountedRef = useRef(active);
  const progress = useSharedValue(0);
  const contentProgress = useSharedValue(0);

  const applyMounted = useCallback((value: boolean) => {
    mountedRef.current = value;
    setMounted(value);
  }, []);

  const startExpand = useCallback(() => {
    progress.set(
      withTiming(1, {
        duration: SEARCH_EXPAND_DURATION,
        easing: EXPAND_EASING,
      })
    );
    contentProgress.set(
      withDelay(
        FIELD_FADE_IN_DELAY,
        withTiming(1, {
          duration: FIELD_FADE_IN_DURATION,
          easing: FADE_EASING,
        })
      )
    );
  }, [progress, contentProgress]);

  useEffect(() => {
    if (active) {
      if (mountedRef.current) {
        startExpand();
        return;
      }

      progress.set(0);
      contentProgress.set(0);
      applyMounted(true);
      return;
    }

    if (!mountedRef.current) return;

    if (closeInstantly) {
      progress.set(0);
      contentProgress.set(0);
      applyMounted(false);
      return;
    }

    contentProgress.set(
      withTiming(0, {
        duration: FIELD_FADE_OUT_DURATION,
        easing: FADE_EASING,
      })
    );
    progress.set(
      withTiming(
        0,
        { duration: SEARCH_COLLAPSE_DURATION, easing: COLLAPSE_EASING },
        (finished) => {
          if (finished) runOnJS(applyMounted)(false);
        }
      )
    );
  }, [
    active,
    closeInstantly,
    progress,
    contentProgress,
    startExpand,
    applyMounted,
  ]);

  return { mounted, progress, contentProgress, startExpand };
};
