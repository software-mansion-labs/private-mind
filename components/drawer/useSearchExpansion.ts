import { useCallback } from 'react';
import {
  Easing,
  SharedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {
  ICON_MORPH_DELAY,
  ICON_MORPH_DURATION,
  SEARCH_COLLAPSE_DURATION,
  SEARCH_EXPAND_DURATION,
  SEARCH_FOOTER_FADE_DURATION,
} from '../../constants/drawer-layout';
import {
  EMPHASIZED_ACCELERATE,
  EMPHASIZED_STANDARD,
} from '../../constants/motion';

const EXPAND_EASING = Easing.bezier(...EMPHASIZED_STANDARD);
const COLLAPSE_EASING = Easing.bezier(...EMPHASIZED_ACCELERATE);
const MORPH_EASING = Easing.inOut(Easing.quad);

export const useSearchExpansion = (expansion: SharedValue<number>) => {
  const iconMorph = useSharedValue(0);
  const footerOpacity = useSharedValue(1);

  const expand = useCallback(() => {
    expansion.set(
      withTiming(1, { duration: SEARCH_EXPAND_DURATION, easing: EXPAND_EASING })
    );
    footerOpacity.set(
      withTiming(0, {
        duration: SEARCH_FOOTER_FADE_DURATION,
        easing: EXPAND_EASING,
      })
    );
    iconMorph.set(
      withDelay(
        ICON_MORPH_DELAY,
        withTiming(1, { duration: ICON_MORPH_DURATION, easing: MORPH_EASING })
      )
    );
  }, [expansion, footerOpacity, iconMorph]);

  const collapse = useCallback(
    (instantly = false) => {
      if (instantly) {
        expansion.set(0);
        footerOpacity.set(1);
        iconMorph.set(0);
        return;
      }

      expansion.set(
        withTiming(0, {
          duration: SEARCH_COLLAPSE_DURATION,
          easing: COLLAPSE_EASING,
        })
      );
      footerOpacity.set(
        withDelay(
          SEARCH_COLLAPSE_DURATION - SEARCH_FOOTER_FADE_DURATION,
          withTiming(1, { duration: SEARCH_FOOTER_FADE_DURATION })
        )
      );
      iconMorph.set(
        withTiming(0, {
          duration: SEARCH_COLLAPSE_DURATION,
          easing: MORPH_EASING,
        })
      );
    },
    [expansion, footerOpacity, iconMorph]
  );

  return { iconMorph, footerOpacity, expand, collapse };
};
