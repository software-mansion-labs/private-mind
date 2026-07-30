import { useDerivedValue } from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useTheme } from '../../context/ThemeContext';

export const useKeyboardLift = () => {
  const { height, progress } = useReanimatedKeyboardAnimation();
  const insetsBottom = useTheme().theme.insets.bottom;
  return useDerivedValue(
    () => height.value + progress.value * insetsBottom,
    [insetsBottom]
  );
};
