import { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';

interface UseMessageBlankSizeParams {
  containerHeight: SharedValue<number>;
  assistantMessageHeight: SharedValue<number>;
  lastUserMessageHeight: SharedValue<number>;
  keyboardHeight: SharedValue<number>;
  keyboardProgress: SharedValue<number>;
  blankSize: SharedValue<number>;
}

/**
 * Hook to calculate and manage blank space size in chat messages.
 *
 * Responsibilities:
 * - Synchronously measure assistant and user message heights
 * - Calculate minimum blank size to push messages to top
 * - Adjust blank size based on keyboard state
 * - Update blankSize shared value in context
 */
export function useMessageBlankSize({
  containerHeight,
  assistantMessageHeight,
  lastUserMessageHeight,
  keyboardHeight,
  keyboardProgress,
  blankSize,
}: UseMessageBlankSizeParams) {
  // Padding between messages and other UI elements
  const VERTICAL_PADDING = 48;

  // Compensation factor for keyboard animation smoothness
  const KEYBOARD_COMPENSATION = 33;
  const { theme } = useTheme();

  const animatedFooterStyle = useAnimatedStyle(() => {
    'worklet';

    // Calculate blank size: container height minus content height minus keyboard
    const calculatedBlankSize = Math.max(
      1,
      containerHeight.value -
        (assistantMessageHeight.value +
          lastUserMessageHeight.value +
          VERTICAL_PADDING) -
        (keyboardHeight.value -
          (theme.insets.bottom - 1) * keyboardProgress.value)
    );

    // Update shared value in context
    blankSize.value = calculatedBlankSize;

    return {
      height: calculatedBlankSize,
    };
  });

  return {
    animatedFooterStyle,
  };
}
