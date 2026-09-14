import { Dimensions, Platform, useWindowDimensions } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useDerivedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CAMERA_ASPECT, COMPOSER, GUTTER, SHEET_TOP_GAP } from './constants';

/**
 * Where everything sits, derived from the one thing that moves it: the
 * keyboard. The composer rides it live on the UI thread; the sheet's React
 * layout takes its settled height, which only matters once it has stopped.
 */
export function useSheetGeometry(panelWindowHeight?: number) {
  const insets = useSafeAreaInsets();
  const { width, height: appWindowHeight } = useWindowDimensions();
  const keyboard = useReanimatedKeyboardAnimation();

  /**
   * The panel is drawn in the window above the keyboard, not in the app's own,
   * and on Android the two can differ: Samsung keeps the status bar out of the
   * app window where a Pixel does not. Everything below is anchored to the
   * bottom edge, so a height short by that strip puts the whole panel — menu,
   * sheet and the photos flying out of it — that much too high, which is what
   * it did on an S20 FE while a Pixel 10 was exact.
   *
   * The over-keyboard view measures itself once it is up and that is the
   * authority. Before then the display's height is the better guess of the
   * two, and it is the right one on any phone that is not sharing the screen.
   */
  const height =
    panelWindowHeight ??
    (Platform.OS === 'android'
      ? Math.max(appWindowHeight, Dimensions.get('screen').height)
      : appWindowHeight);

  // `keyboard.height` is negative while the keyboard is up, which is what makes
  // it drop straight into a translate.
  const liftedBy = useDerivedValue(
    () =>
      Math.max(-keyboard.height.get(), insets.bottom) +
      COMPOSER.barPaddingBottom
  );
  const composerBottom = useDerivedValue(() => height - liftedBy.get());

  /**
   * One footprint for both sheets, the way the reference has it: a portrait 3:4
   * frame standing on the bottom gutter, never taller than the safe area
   * allows. The camera needs that shape — a preview stretched down a 20:9 phone
   * crops most of what the lens sees — and the grid matching it is what keeps
   * the morph a single move rather than two destinations.
   *
   * The bottom is the safe area's, not the screen's: Android's navigation bar
   * lives in that strip and the sheet was running underneath it.
   */
  const sheetBottom = height - insets.bottom - GUTTER;
  const sheetTop = Math.max(
    insets.top + SHEET_TOP_GAP,
    sheetBottom - (width - GUTTER * 2) * CAMERA_ASPECT
  );
  const menuMaxBottom = height - insets.bottom - GUTTER;
  // The sheet keeps the composer's gutter rather than going full bleed, and
  // stops a gutter short of the bottom — so the grid inside it does too.
  const gridWidth = width - GUTTER * 2;
  const gridHeight = sheetBottom - sheetTop;

  return {
    width,
    height,
    composerBottom,
    gridWidth,
    gridHeight,
    sheetTop,
    sheetBottom,
    menuMaxBottom,
  };
}
