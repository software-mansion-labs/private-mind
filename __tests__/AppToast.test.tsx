import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import Toast from 'react-native-toast-message';
import AppToast from '../components/AppToast';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('react-native-screens', () => ({
  FullWindowOverlay: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('react-native-toast-message', () =>
  jest.requireActual('../node_modules/react-native-toast-message/lib')
);
jest.mock('../utils/openAppSettings', () => ({ openAppSettings: jest.fn() }));

const showToast = (props?: { settings: boolean }) => {
  const screen = render(<AppToast />);
  act(() => {
    Toast.show({ type: 'defaultToast', text1: 'Saved', props });
  });
  return screen;
};

describe('AppToast', () => {
  it('closes when the cross is pressed', () => {
    const hide = jest.spyOn(Toast, 'hide');
    const { getByTestId } = showToast();

    fireEvent.press(getByTestId('toast-close'));

    expect(hide).toHaveBeenCalledTimes(1);
  });

  it.each(['toast-close', 'toast-open-settings'])(
    'keeps the press on %s when the swipe-to-dismiss container asks for the touch',
    (testID) => {
      const { getByTestId } = showToast({ settings: true });

      expect(getByTestId(testID).props.onResponderTerminationRequest()).toBe(
        false
      );
    }
  );

  it('names the cross for a screen reader', () => {
    const { getByLabelText } = showToast();

    expect(getByLabelText('Dismiss')).toBeTruthy();
  });
});
