import { Keyboard } from 'react-native';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

export const runAfterUiUpdates = (callback: () => void) => {
  scheduleOnUI(() => {
    'worklet';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scheduleOnRN(callback);
      });
    });
  });
};

const dismissKeyboard = () => Keyboard.dismiss();

export const dismissKeyboardAfterUiUpdates = () =>
  runAfterUiUpdates(dismissKeyboard);
