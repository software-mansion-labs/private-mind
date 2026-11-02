import { Platform } from 'react-native';

export const SCROLL_INDICATOR_RIGHT_NUDGE = 1;

export const SCROLL_INDICATOR_INPUT_GAP = 8;

export const scrollIndicatorProps = (topInset = 0, bottomInset = 0) =>
  Platform.OS === 'ios'
    ? ({
        automaticallyAdjustsScrollIndicatorInsets: false,
        scrollIndicatorInsets: {
          top: topInset,
          bottom: bottomInset,
          right: SCROLL_INDICATOR_RIGHT_NUDGE,
        },
      } as const)
    : ({} as const);
