import { useEffect } from 'react';
import { Keyboard } from 'react-native';
import {
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useTheme } from '../../context/ThemeContext';

export const useKeyboardLift = () => {
  const { height, progress } = useReanimatedKeyboardAnimation();
  const insetsBottom = useTheme().theme.insets.bottom;
  const keyboardGone = useSharedValue(false);

  useAnimatedReaction(
    () => progress.value,
    (current, previous) => {
      if (previous !== null && current > previous) keyboardGone.value = false;
    }
  );

  useEffect(() => {
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      keyboardGone.value = true;
    });
    const shown = Keyboard.addListener('keyboardDidShow', () => {
      keyboardGone.value = false;
    });
    return () => {
      hidden.remove();
      shown.remove();
    };
  }, [keyboardGone]);

  return useDerivedValue(
    () =>
      keyboardGone.value ? 0 : height.value + progress.value * insetsBottom,
    [insetsBottom]
  );
};
