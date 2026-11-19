import { Dimensions, Platform, useWindowDimensions } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useDerivedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomBarPadding } from '../../../constants/design-system';
import { CAMERA_ASPECT, COMPOSER, GUTTER, SHEET_TOP_GAP } from './constants';

export function useSheetGeometry(panelWindowHeight?: number) {
  const insets = useSafeAreaInsets();
  const { width, height: appWindowHeight } = useWindowDimensions();
  const keyboard = useReanimatedKeyboardAnimation();

  const height =
    panelWindowHeight ??
    (Platform.OS === 'android'
      ? Math.max(appWindowHeight, Dimensions.get('screen').height)
      : appWindowHeight);

  const restPadding = bottomBarPadding(insets.bottom);
  const liftedBy = useDerivedValue(() =>
    Math.max(-keyboard.height.get() + COMPOSER.keyboardGap, restPadding)
  );
  const composerBottom = useDerivedValue(() => height - liftedBy.get());

  const composerRestBottom = height - restPadding;
  const sheetBottom = composerRestBottom;
  const sheetTop = Math.max(
    insets.top + SHEET_TOP_GAP,
    sheetBottom - (width - GUTTER * 2) * CAMERA_ASPECT
  );
  const menuMaxBottom = composerRestBottom;
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
