import { useEffect, useRef } from 'react';
import { Keyboard } from 'react-native';
import {
  KeyboardController,
  KeyboardEvents,
} from 'react-native-keyboard-controller';

export const useHoldKeyboardWhileOpen = (
  open: boolean,
  setOwnsKeyboard: (owns: boolean) => void
) => {
  const claimed = useRef(false);

  useEffect(() => {
    if (open) {
      claimed.current = true;
      setOwnsKeyboard(true);
      return;
    }
    if (!claimed.current) return;
    const release = () => {
      claimed.current = false;
      setOwnsKeyboard(false);
    };
    if (!KeyboardController.isVisible()) {
      release();
      return;
    }
    Keyboard.dismiss();
    const hidden = KeyboardEvents.addListener('keyboardDidHide', release);
    return () => hidden.remove();
  }, [open, setOwnsKeyboard]);

  useEffect(
    () => () => {
      if (claimed.current) setOwnsKeyboard(false);
    },
    [setOwnsKeyboard]
  );
};
