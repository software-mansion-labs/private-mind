import { useCallback, useRef } from 'react';
import {
  Easing,
  LinearTransition,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

export const BAR_GROW_DURATION = 200;
export const BAR_GROW_EASING = Easing.out(Easing.ease);
export const BAR_GROW_LAYOUT =
  LinearTransition.duration(BAR_GROW_DURATION).easing(BAR_GROW_EASING);

export interface BarLayoutEvent {
  nativeEvent: { layout: { height: number } };
}

interface Options {
  extraContentPadding: SharedValue<number>;
  hasMessages: boolean;
  isResting: boolean;
  insetBottom: number;
  onHeightChange?: (height: number) => void;
  onBarGrow?: () => void;
}

export const useBarGrowth = ({
  extraContentPadding,
  hasMessages,
  isResting,
  insetBottom,
  onHeightChange,
  onBarGrow,
}: Options): ((event: BarLayoutEvent) => void) => {
  const defaultBarHeight = useRef(0);
  const prevBarHeight = useRef(0);

  // Inset the baseline was captured with. Checked in the layout handler, not
  // an effect: onLayout fires first, so an effect-driven reset would lose the
  // pass carrying the new height.
  const baselineInset = useRef<number | null>(null);

  return useCallback(
    (event: BarLayoutEvent) => {
      const height = event.nativeEvent.layout.height;
      // Only capture the default height once we're in the "with messages"
      // layout — otherwise the empty-state extras (WhatsNewCard, prompt
      // suggestions) would bake into the baseline and squeeze the scroll
      // view once they disappear. Re-capture on inset changes (Android
      // navigation mode, rotation), or the stale baseline reads the difference
      // as "the bar grew".
      if (hasMessages && isResting) {
        if (baselineInset.current !== insetBottom) {
          defaultBarHeight.current = height;
          baselineInset.current = insetBottom;
        } else if (
          defaultBarHeight.current === 0 ||
          height < defaultBarHeight.current
        ) {
          defaultBarHeight.current = height;
        }
      }
      const baseline = defaultBarHeight.current || height;
      const delta = height - baseline;
      extraContentPadding.set(
        withTiming(Math.max(0, delta), {
          duration: BAR_GROW_DURATION,
          easing: BAR_GROW_EASING,
        })
      );
      // Baseline, not live height — consumers must not follow the bar as it
      // grows with typed lines; that is what extraContentPadding is for.
      onHeightChange?.(hasMessages ? baseline : 0);
      const grew = height > prevBarHeight.current;
      prevBarHeight.current = height;
      if (delta > 0 && grew) {
        onBarGrow?.();
      }
    },
    [
      extraContentPadding,
      hasMessages,
      insetBottom,
      isResting,
      onBarGrow,
      onHeightChange,
    ]
  );
};
