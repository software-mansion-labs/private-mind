import { renderHook } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import { useKeyboardLift } from '../components/chat-screen/useKeyboardLift';

let mockInsetsBottom = 0;
const mockHeight = { value: 0 };
const mockProgress = { value: 0 };

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      insets: { top: 0, bottom: mockInsetsBottom, left: 0, right: 0 },
    },
  }),
}));

let keyboardHandler: {
  onMove?: (event: { height: number; progress: number }) => void;
  onEnd?: (event: { height: number; progress: number }) => void;
} = {};

jest.mock('react-native-keyboard-controller', () => ({
  useReanimatedKeyboardAnimation: () => ({
    height: mockHeight,
    progress: mockProgress,
  }),
  useKeyboardHandler: (handler: typeof keyboardHandler) => {
    keyboardHandler = handler;
  },
}));

describe('useKeyboardLift', () => {
  beforeEach(() => {
    mockHeight.value = 0;
    mockProgress.value = 0;
    mockInsetsBottom = 0;
    keyboardHandler = {};
  });

  it('returns 0 when the keyboard is closed', () => {
    const { result } = renderHook(() => useKeyboardLift());

    expect(result.current.value).toBe(0);
  });

  it('gives back the bottom inset the open keyboard swallows', () => {
    mockInsetsBottom = 34;
    mockHeight.value = -346;
    mockProgress.value = 1;

    const { result } = renderHook(() => useKeyboardLift());

    expect(result.current.value).toBe(-312);
  });

  it('scales the inset compensation with keyboard progress', () => {
    mockInsetsBottom = 34;
    mockHeight.value = -173;
    mockProgress.value = 0.5;

    const { result } = renderHook(() => useKeyboardLift());

    expect(result.current.value).toBe(-156);
  });

  it('equals the raw keyboard height on a device without a bottom inset', () => {
    mockHeight.value = -300;
    mockProgress.value = 1;

    const { result } = renderHook(() => useKeyboardLift());

    expect(result.current.value).toBe(-300);
  });

  it('drops the bar back when the keyboard finishes hiding', () => {
    mockInsetsBottom = 34;
    mockHeight.value = -346;
    mockProgress.value = 1;

    const { result, rerender } = renderHook(() => useKeyboardLift());
    expect(result.current.value).toBe(-312);

    keyboardHandler.onEnd!({ height: 0, progress: 0 });
    rerender({});

    expect(result.current.value).toBe(0);
  });

  // Sending a message dismisses the keyboard and then holds the JS thread for
  // seconds. The bar was left stranded because the reset rode a JS listener.
  it('resets without any JS-thread keyboard event', () => {
    const spy = jest.spyOn(Keyboard, 'addListener');
    mockInsetsBottom = 34;
    mockHeight.value = -346;
    mockProgress.value = 1;

    const { result, rerender } = renderHook(() => useKeyboardLift());
    keyboardHandler.onEnd!({ height: 0, progress: 0 });
    rerender({});

    expect(result.current.value).toBe(0);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('lifts again as soon as the keyboard starts coming back', () => {
    mockInsetsBottom = 34;
    const { result, rerender } = renderHook(() => useKeyboardLift());

    keyboardHandler.onEnd!({ height: 0, progress: 0 });
    rerender({});
    expect(result.current.value).toBe(0);

    // The library reports the height as a translate here and as a raw height
    // elsewhere, so the reset must not depend on its sign.
    keyboardHandler.onMove!({ height: 346, progress: 1 });
    mockHeight.value = -346;
    mockProgress.value = 1;
    rerender({});

    expect(result.current.value).toBe(-312);
  });

  it('recomputes after the keyboard values change', () => {
    mockInsetsBottom = 34;
    const { result, rerender } = renderHook(() => useKeyboardLift());

    expect(result.current.value).toBe(0);

    mockHeight.value = -346;
    mockProgress.value = 1;
    rerender({});

    expect(result.current.value).toBe(-312);
  });
});
