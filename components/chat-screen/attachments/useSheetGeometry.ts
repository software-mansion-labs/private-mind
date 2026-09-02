import { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  useKeyboardHandler,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import { useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { COMPOSER, GUTTER, sheetTopFromComposerBottom } from './constants';

/**
 * Where everything sits, derived from the one thing that moves it: the
 * keyboard. The composer rides it live on the UI thread; the sheet's React
 * layout takes its settled height, which only matters once it has stopped.
 */
export function useSheetGeometry() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const keyboard = useReanimatedKeyboardAnimation();
  const [settledKeyboard, setSettledKeyboard] = useState(0);

  // `keyboard.height` is negative while the keyboard is up, which is what makes
  // it drop straight into a translate.
  const liftedBy = useDerivedValue(
    () =>
      Math.max(-keyboard.height.get(), insets.bottom) +
      COMPOSER.barPaddingBottom
  );
  const composerBottom = useDerivedValue(() => height - liftedBy.get());
  const composerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -liftedBy.get() }],
  }));

  // The grid is laid out in React, so it needs a plain number.
  useKeyboardHandler(
    {
      onEnd: (event) => {
        'worklet';
        scheduleOnRN(setSettledKeyboard, event.height);
      },
    },
    []
  );

  const settledBottom =
    height -
    Math.max(settledKeyboard, insets.bottom) -
    COMPOSER.barPaddingBottom;
  const panelTop = sheetTopFromComposerBottom(settledBottom);
  // The sheet keeps the composer's gutter rather than going full bleed, and
  // stops a gutter short of the bottom — so the grid inside it does too.
  const gridWidth = width - GUTTER * 2;
  const gridHeight = height - panelTop - GUTTER;

  return {
    width,
    height,
    composerBottom,
    composerStyle,
    gridWidth,
    gridHeight,
  };
}
