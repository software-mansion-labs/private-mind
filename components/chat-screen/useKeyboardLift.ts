import { useEffect } from 'react';
import { AppState, Keyboard } from 'react-native';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import {
  useKeyboardHandler,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import { useTheme } from '../../context/ThemeContext';

export const useKeyboardLift = () => {
  const { height, progress } = useReanimatedKeyboardAnimation();
  const insetsBottom = useTheme().theme.insets.bottom;
  const keyboardGone = useSharedValue(false);

  // Worklet: sending a message blocks the JS thread past the keyboard's hide.
  useKeyboardHandler(
    {
      onMove: (event) => {
        'worklet';
        if (event.height !== 0) keyboardGone.value = false;
      },
      onEnd: (event) => {
        'worklet';
        keyboardGone.value = event.height === 0;
      },
    },
    []
  );

  // Catches an unanimated hide the keyboard controller does not report.
  useEffect(() => {
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      keyboardGone.value = true;
    });
    const shown = Keyboard.addListener('keyboardDidShow', () => {
      keyboardGone.value = false;
    });
    const foreground = AppState.addEventListener('change', (next) => {
      if (next === 'active' && !Keyboard.isVisible()) keyboardGone.value = true;
    });
    return () => {
      hidden.remove();
      shown.remove();
      foreground.remove();
    };
  }, [keyboardGone]);

  return useDerivedValue(
    () =>
      keyboardGone.value ? 0 : height.value + progress.value * insetsBottom,
    [insetsBottom]
  );
};
