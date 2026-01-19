import React from 'react';
import { SharedValue, useSharedValue } from 'react-native-reanimated';
import { scrollTo, useAnimatedReaction } from 'react-native-reanimated';
import { useKeyboardHandler } from 'react-native-keyboard-controller';

interface UseKeyboardAwareMessageListParams {
  chatListRef: any;
  isAtBottom: boolean;
  blankSize: SharedValue<number>;
}

enum ScrollingCase {
  BLANK_LARGER_THAN_KEYBOARD = 1, // Content stays in place
  NO_BLANK_SPACE = 2, // Content shifts up with keyboard
  BLANK_SMALLER_THAN_KEYBOARD = 3, // Blank shrinks, content shifts up
}

/**
 * Hook to handle keyboard-aware scrolling behavior for message list.
 *
 * Responsibilities:
 * - Track keyboard state (opening, closing, height, progress)
 * - Determine scrolling behavior based on blank space size
 * - Scroll to maintain bottom position when appropriate
 * - Handle keyboard animation synchronization
 */
export function useKeyboardAwareMessageList({
  chatListRef,
  isAtBottom,
  blankSize,
}: UseKeyboardAwareMessageListParams) {
  const isAtBottomValue = useSharedValue(isAtBottom);
  const keyboardHeight = useSharedValue(0);
  const keyboardProgress = useSharedValue(0);
  const isKeyboardOpening = useSharedValue(false);
  const isKeyboardClosing = useSharedValue(false);
  const scrollingCase = useSharedValue<ScrollingCase | null>(null);

  // iOS keyboard height (approximate, varies by device)
  const KEYBOARD_HEIGHT_THRESHOLD = 335;

  // Sync isAtBottom state with shared value
  React.useEffect(() => {
    isAtBottomValue.value = isAtBottom;
  }, [isAtBottom, isAtBottomValue]);

  // Handle keyboard events
  useKeyboardHandler({
    onStart: (e) => {
      'worklet';
      if (e.height > 0) {
        // Keyboard opening
        isKeyboardOpening.value = true;
        isKeyboardClosing.value = false;

        // Determine scrolling behavior based on blank size
        if (blankSize.value > KEYBOARD_HEIGHT_THRESHOLD) {
          scrollingCase.value = ScrollingCase.BLANK_LARGER_THAN_KEYBOARD;
        } else if (blankSize.value === 1) {
          scrollingCase.value = ScrollingCase.NO_BLANK_SPACE;
        } else if (blankSize.value <= KEYBOARD_HEIGHT_THRESHOLD) {
          scrollingCase.value = ScrollingCase.BLANK_SMALLER_THAN_KEYBOARD;
        }
      } else {
        // Keyboard closing
        isKeyboardOpening.value = false;
        isKeyboardClosing.value = true;
      }
    },

    onMove: (e) => {
      'worklet';
      keyboardHeight.value = e.height;
      keyboardProgress.value = e.progress;
    },

    onEnd: (e) => {
      'worklet';
      keyboardHeight.value = e.height;
      keyboardProgress.value = e.progress;

      if (e.height === 0) {
        scrollingCase.value = null;
      }
    },
  });

  // Handle scroll-to-bottom logic based on keyboard state
  useAnimatedReaction(
    () => ({
      kb: keyboardHeight.value,
      blank: blankSize.value,
      atBottom: isAtBottomValue.value,
    }),
    (current, previous) => {
      'worklet';
      if (!current.atBottom || !previous) return;

      const kbHeightChange = Math.abs(current.kb - previous.kb);

      // Handle keyboard opening
      if (isKeyboardOpening.value) {
        // Case 1: Blank larger than keyboard - content stays in place
        if (
          scrollingCase.value === ScrollingCase.BLANK_LARGER_THAN_KEYBOARD &&
          kbHeightChange === 0
        ) {
          scrollTo(chatListRef, 0, 999999, false);
        }

        if (scrollingCase.value === ScrollingCase.BLANK_LARGER_THAN_KEYBOARD) {
          return;
        }

        // Case 2 & 3: Shift content up
        if (
          scrollingCase.value === ScrollingCase.BLANK_SMALLER_THAN_KEYBOARD ||
          scrollingCase.value === ScrollingCase.NO_BLANK_SPACE
        ) {
          scrollTo(chatListRef, 0, 999999, false);
        }
      }

      // Handle keyboard closing
      if (isKeyboardClosing.value) {
        if (
          scrollingCase.value === ScrollingCase.BLANK_LARGER_THAN_KEYBOARD &&
          kbHeightChange === 0
        ) {
          scrollTo(chatListRef, 0, 999999, false);
        }

        if (scrollingCase.value === ScrollingCase.BLANK_LARGER_THAN_KEYBOARD) {
          return;
        }

        scrollTo(chatListRef, 0, 999999, false);
      }
    }
  );

  return {
    keyboardHeight,
    keyboardProgress,
  };
}
