import { useWindowDimensions } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CAMERA_ASPECT, COMPOSER, GUTTER, SHEET_TOP_GAP } from './constants';

/**
 * Where everything sits, derived from the one thing that moves it: the
 * keyboard. The composer rides it live on the UI thread; the sheet's React
 * layout takes its settled height, which only matters once it has stopped.
 */
export function useSheetGeometry() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const keyboard = useReanimatedKeyboardAnimation();

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

  /** The sheet hangs from the top of the screen, not from the keyboard. */
  const sheetTop = insets.top + SHEET_TOP_GAP;
  /**
   * How low the menu shape may be drawn. It is centred on the + button, and
   * with no keyboard under it that button sits just above the screen edge — so
   * without this the last row runs off the bottom.
   */
  const menuMaxBottom = height - insets.bottom - GUTTER;
  // The sheet keeps the composer's gutter rather than going full bleed, and
  // stops a gutter short of the bottom — so the grid inside it does too.
  const gridWidth = width - GUTTER * 2;
  const gridHeight = height - sheetTop - GUTTER;
  /** The camera's own top edge — never lower than the grid's. */
  const cameraTop = Math.max(
    sheetTop,
    height - GUTTER - gridWidth * CAMERA_ASPECT
  );
  const cameraHeight = height - cameraTop - GUTTER;

  return {
    width,
    height,
    composerBottom,
    composerStyle,
    gridWidth,
    gridHeight,
    sheetTop,
    cameraTop,
    cameraHeight,
    menuMaxBottom,
  };
}
