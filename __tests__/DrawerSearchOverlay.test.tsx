import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Modal, Platform, TextInput } from 'react-native';
import { KeyboardController } from 'react-native-keyboard-controller';
import { DrawerSearchOverlay } from '../components/drawer/DrawerSearchOverlay';
import {
  ANDROID_KEYBOARD_RETRY_DELAY,
  ANDROID_SEARCH_FOCUS_DELAY,
} from '../constants/drawer-layout';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

jest.mock('react-native-gesture-handler', () => {
  const RN = require('react-native');
  return { GestureHandlerRootView: RN.View, Pressable: RN.Pressable };
});

let mockMenuProps: { onMenuActiveChange: (active: boolean) => void } | null =
  null;

jest.mock('../components/drawer/DrawerMenu', () => ({
  __esModule: true,
  default: (props: { onMenuActiveChange: (active: boolean) => void }) => {
    mockMenuProps = props;
    return null;
  },
}));

jest.mock('../components/drawer/DrawerFooter', () => ({
  DrawerFooter: () => null,
}));

const FRAME = 16;
const RETRY_AT = ANDROID_SEARCH_FOCUS_DELAY + ANDROID_KEYBOARD_RETRY_DELAY;

const setPlatform = (os: string) => {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
};

const ORIGINAL_OS = Platform.OS;

const makeInput = (focused = false) => ({
  focus: jest.fn(),
  isFocused: jest.fn(() => focused),
});

type FakeInput = ReturnType<typeof makeInput>;

const renderOverlay = (input: FakeInput, onMenuActiveChange = jest.fn()) => {
  const inputRef = { current: input as unknown as TextInput };
  const props = {
    closeInstantly: false,
    search: '',
    now: 0,
    navHeight: 0,
    onNavMeasured: jest.fn(),
    onChangeSearch: jest.fn(),
    onRequestClose: jest.fn(),
    onSearchBlur: jest.fn(),
    onMenuActiveChange,
    onNavigate: jest.fn(),
    inputRef,
    scrollOffsetRef: { current: 0 },
  };
  const utils = render(<DrawerSearchOverlay active {...props} />);
  const close = () =>
    utils.rerender(<DrawerSearchOverlay active={false} {...props} />);
  const show = () => fireEvent(utils.UNSAFE_getByType(Modal), 'show');
  return { ...utils, close, show };
};

const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

const setMenuActive = (active: boolean) =>
  act(() => mockMenuProps?.onMenuActiveChange(active));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockMenuProps = null;
});

afterEach(() => {
  jest.useRealTimers();
  setPlatform(ORIGINAL_OS);
});

describe('DrawerSearchOverlay on Android', () => {
  beforeEach(() => setPlatform('android'));

  it('waits for the dialog window to take input before focusing the field', () => {
    const input = makeInput();
    const { show } = renderOverlay(input);

    show();
    advance(FRAME);
    expect(input.focus).not.toHaveBeenCalled();

    advance(ANDROID_SEARCH_FOCUS_DELAY - FRAME);
    expect(input.focus).toHaveBeenCalledTimes(1);
  });

  it('asks for the keyboard again natively when the field kept focus without one', () => {
    const input = makeInput(true);
    const { show } = renderOverlay(input);

    show();
    advance(RETRY_AT - 1);
    expect(KeyboardController.setFocusTo).not.toHaveBeenCalled();

    advance(1);
    expect(KeyboardController.setFocusTo).toHaveBeenCalledWith('current');
  });

  it('leaves the keyboard alone when the field lost focus before the retry', () => {
    const input = makeInput(false);
    const { show } = renderOverlay(input);

    show();
    advance(RETRY_AT);

    expect(KeyboardController.setFocusTo).not.toHaveBeenCalled();
  });

  it('drops the pending focus when the search closes first', () => {
    const input = makeInput(true);
    const { show, close } = renderOverlay(input);

    show();
    advance(ANDROID_SEARCH_FOCUS_DELAY / 2);
    close();
    advance(RETRY_AT);

    expect(input.focus).not.toHaveBeenCalled();
    expect(KeyboardController.setFocusTo).not.toHaveBeenCalled();
  });

  it('drops the pending focus when the overlay unmounts first', () => {
    const input = makeInput(true);
    const { show, unmount } = renderOverlay(input);

    show();
    unmount();
    advance(RETRY_AT);

    expect(input.focus).not.toHaveBeenCalled();
    expect(KeyboardController.setFocusTo).not.toHaveBeenCalled();
  });

  it('refocuses the field with the same delay after the chat menu closes', () => {
    const input = makeInput();
    const onMenuActiveChange = jest.fn();
    renderOverlay(input, onMenuActiveChange);

    setMenuActive(true);
    setMenuActive(false);
    expect(onMenuActiveChange).toHaveBeenLastCalledWith(false);
    expect(input.focus).not.toHaveBeenCalled();

    advance(ANDROID_SEARCH_FOCUS_DELAY);
    expect(input.focus).toHaveBeenCalledTimes(1);
  });

  it('drops a pending focus when the chat menu opens over the field', () => {
    const input = makeInput(true);
    const { show } = renderOverlay(input);

    show();
    setMenuActive(true);
    advance(RETRY_AT);

    expect(input.focus).not.toHaveBeenCalled();
    expect(KeyboardController.setFocusTo).not.toHaveBeenCalled();
  });
});

describe('DrawerSearchOverlay on iOS', () => {
  beforeEach(() => setPlatform('ios'));

  it('focuses the field on the next frame after the modal shows', () => {
    const input = makeInput(true);
    const { show } = renderOverlay(input);

    show();
    advance(FRAME);

    expect(input.focus).toHaveBeenCalledTimes(1);
    advance(RETRY_AT);
    expect(KeyboardController.setFocusTo).not.toHaveBeenCalled();
  });

  it('refocuses the field at once after the chat menu closes', () => {
    const input = makeInput();
    renderOverlay(input);

    setMenuActive(true);
    setMenuActive(false);

    expect(input.focus).toHaveBeenCalledTimes(1);
  });
});
