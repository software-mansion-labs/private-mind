import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Easing,
  runOnJS,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {
  BACKDROP_FADE_IN_DURATION,
  ICON_MORPH_DELAY,
  ICON_MORPH_DURATION,
  SEARCH_COLLAPSE_DURATION,
  SEARCH_EXPAND_DURATION,
  SEARCH_UNMOUNT_GRACE,
} from '../../constants/drawer-layout';
import {
  EMPHASIZED_ACCELERATE,
  EMPHASIZED_DECELERATE,
} from '../../constants/motion';

const EXPAND_EASING = Easing.bezier(...EMPHASIZED_DECELERATE);
const COLLAPSE_EASING = Easing.bezier(...EMPHASIZED_ACCELERATE);
const MORPH_EASING = Easing.inOut(Easing.quad);

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
  const backdropOpacity = useSharedValue(0);
  const iconMorph = useSharedValue(0);

  const applyMounted = useCallback((value: boolean) => {
    mountedRef.current = value;
    setMounted(value);
  }, []);

  const startExpand = useCallback(() => {
    backdropOpacity.set(
      withTiming(1, {
        duration: BACKDROP_FADE_IN_DURATION,
        easing: EXPAND_EASING,
      })
    );
    iconMorph.set(
      withDelay(
        ICON_MORPH_DELAY,
        withTiming(1, { duration: ICON_MORPH_DURATION, easing: MORPH_EASING })
      )
    );
    progress.set(
      withTiming(1, {
        duration: SEARCH_EXPAND_DURATION,
        easing: EXPAND_EASING,
      })
    );
  }, [progress, backdropOpacity, iconMorph]);

  useEffect(() => {
    if (active) {
      if (mountedRef.current) {
        startExpand();
        return;
      }

      progress.set(0);
      backdropOpacity.set(0);
      iconMorph.set(0);
      applyMounted(true);
      return;
    }

    if (!mountedRef.current) return;

    if (closeInstantly) {
      progress.set(0);
      backdropOpacity.set(0);
      iconMorph.set(0);
      applyMounted(false);
      return;
    }

    iconMorph.set(
      withTiming(0, {
        duration: SEARCH_COLLAPSE_DURATION,
        easing: MORPH_EASING,
      })
    );
    backdropOpacity.set(
      withTiming(0, {
        duration: SEARCH_COLLAPSE_DURATION,
        easing: COLLAPSE_EASING,
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

    const forceUnmount = setTimeout(
      () => applyMounted(false),
      SEARCH_COLLAPSE_DURATION + SEARCH_UNMOUNT_GRACE
    );
    return () => clearTimeout(forceUnmount);
  }, [
    active,
    closeInstantly,
    progress,
    backdropOpacity,
    iconMorph,
    startExpand,
    applyMounted,
  ]);

  return { mounted, progress, iconMorph, backdropOpacity, startExpand };
};
