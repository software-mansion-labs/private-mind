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

  // Runs on the UI thread on purpose. Sending a message dismisses the keyboard
  // and then occupies the JS thread for seconds, so a JS-side keyboardDidHide
  // listener cannot land and the bar stays stranded at the keyboard's height.
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

  // The controller misses a hide that has no animation (an IME swapped or
  // closed by the system, a return from background); the system events catch
  // those whenever the JS thread is free to deliver them.
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
