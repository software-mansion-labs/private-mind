import { RefObject, useCallback, useEffect, useRef } from 'react';
import { Platform, TextInput } from 'react-native';
import { KeyboardController } from 'react-native-keyboard-controller';
import {
  ANDROID_KEYBOARD_RETRY_DELAY,
  ANDROID_SEARCH_FOCUS_DELAY,
} from '../../constants/drawer-layout';

export const useSearchInputFocus = (
  inputRef: RefObject<TextInput | null>,
  active: boolean
) => {
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const cancelPendingFocus = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    if (!active) cancelPendingFocus();
  }, [active, cancelPendingFocus]);

  useEffect(() => cancelPendingFocus, [cancelPendingFocus]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  const reshowKeyboardIfStillFocused = useCallback(() => {
    if (inputRef.current?.isFocused()) KeyboardController.setFocusTo('current');
  }, [inputRef]);

  const focusOnceWindowTakesInput = useCallback(() => {
    cancelPendingFocus();
    timersRef.current = [
      setTimeout(focusInput, ANDROID_SEARCH_FOCUS_DELAY),
      setTimeout(
        reshowKeyboardIfStillFocused,
        ANDROID_SEARCH_FOCUS_DELAY + ANDROID_KEYBOARD_RETRY_DELAY
      ),
    ];
  }, [cancelPendingFocus, focusInput, reshowKeyboardIfStillFocused]);

  const focusAfterShow = useCallback(() => {
    if (Platform.OS === 'android') {
      focusOnceWindowTakesInput();
      return;
    }
    requestAnimationFrame(focusInput);
  }, [focusOnceWindowTakesInput, focusInput]);

  const refocus = useCallback(() => {
    if (Platform.OS === 'android') {
      focusOnceWindowTakesInput();
      return;
    }
    focusInput();
  }, [focusOnceWindowTakesInput, focusInput]);

  return { focusAfterShow, refocus, cancelPendingFocus };
};
