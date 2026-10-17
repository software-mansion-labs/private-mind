import React from 'react';
import { act, render } from '@testing-library/react-native';
import Toast from 'react-native-toast-message';
import { AnimatedContainer } from 'react-native-toast-message/lib/src/components/AnimatedContainer';
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

const VISIBILITY_MS = 4000;

const fingerAt = (onScreen: boolean) => ({
  nativeEvent: { touches: onScreen ? [{}] : [], changedTouches: [{}] },
  touchHistory: {
    touchBank: [
      {
        touchActive: onScreen,
        startPageX: 200,
        startPageY: 150,
        startTimeStamp: 0,
        currentPageX: 200,
        currentPageY: 150,
        currentTimeStamp: 0,
        previousPageX: 200,
        previousPageY: 150,
        previousTimeStamp: 0,
      },
    ],
    numberActiveTouches: onScreen ? 1 : 0,
    indexOfSingleActiveTouch: 0,
    mostRecentTimeStamp: 0,
  },
});

const renderToast = () => {
  const screen = render(<AppToast />);
  const isVisible = () =>
    screen.UNSAFE_getByType(AnimatedContainer).props.isVisible;
  const swipeContainer = () =>
    screen.UNSAFE_root.find(
      (node) =>
        typeof node.type === 'string' &&
        typeof node.props.onResponderGrant === 'function' &&
        typeof node.props.onMoveShouldSetResponderCapture === 'function'
    );
  const show = (text1: string) =>
    act(() => {
      Toast.show({ type: 'defaultToast', text1 });
    });
  const putFingerDown = () =>
    act(() => {
      swipeContainer().props.onResponderGrant(fingerAt(true));
    });
  const liftFinger = () =>
    act(() => {
      swipeContainer().props.onResponderRelease(fingerAt(false));
    });
  const wait = (ms: number) =>
    act(() => {
      jest.advanceTimersByTime(ms);
    });
  return { isVisible, show, putFingerDown, liftFinger, wait };
};

describe('toast auto-hide', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('hides on its own after the visibility time', () => {
    const toast = renderToast();
    toast.show('Gemma 4 - 2B has been successfully downloaded');

    toast.wait(VISIBILITY_MS);

    expect(toast.isVisible()).toBe(false);
  });

  it('still hides when a finger was on it the moment it was due to hide', () => {
    const toast = renderToast();
    toast.show('Gemma 4 - 2B has been successfully downloaded');

    toast.wait(VISIBILITY_MS - 100);
    toast.putFingerDown();
    toast.wait(200);
    toast.liftFinger();
    toast.wait(VISIBILITY_MS);

    expect(toast.isVisible()).toBe(false);
  });

  it('stays up while the finger is still on it', () => {
    const toast = renderToast();
    toast.show('Gemma 4 - 2B has been successfully downloaded');

    toast.putFingerDown();
    toast.wait(VISIBILITY_MS * 3);

    expect(toast.isVisible()).toBe(true);
  });

  it('gives the next toast its full visibility time after a held one', () => {
    const toast = renderToast();
    toast.show('Gemma 4 - 2B has been successfully downloaded');
    toast.putFingerDown();
    toast.wait(VISIBILITY_MS + 100);
    toast.liftFinger();

    toast.wait(1000);
    toast.show('Qwen 3 - 1.7B has been successfully downloaded');
    toast.wait(VISIBILITY_MS - 500);

    expect(toast.isVisible()).toBe(true);
  });
});
