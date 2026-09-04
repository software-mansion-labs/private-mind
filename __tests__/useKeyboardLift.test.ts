import { renderHook } from '@testing-library/react-native';
import { AppState, Keyboard } from 'react-native';
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
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation(
        () =>
          ({ remove: jest.fn() }) as unknown as ReturnType<
            typeof AppState.addEventListener
          >
      );
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
    const listeners = new Map<string, () => void>();
    const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation(((
      name: string,
      handler: () => void
    ) => {
      listeners.set(name, handler);
      return { remove: jest.fn() };
    }) as unknown as typeof Keyboard.addListener);
    mockInsetsBottom = 34;
    mockHeight.value = -346;
    mockProgress.value = 1;

    const { result, rerender } = renderHook(() => useKeyboardLift());
    keyboardHandler.onEnd!({ height: 0, progress: 0 });
    rerender({});

    expect(result.current.value).toBe(0);
    expect(listeners.size).toBe(2);
    spy.mockRestore();
  });

  it('drops the bar when the system reports the keyboard hidden and the controller never did', () => {
    const listeners = new Map<string, () => void>();
    const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation(((
      name: string,
      handler: () => void
    ) => {
      listeners.set(name, handler);
      return { remove: jest.fn() };
    }) as unknown as typeof Keyboard.addListener);
    mockInsetsBottom = 34;
    mockHeight.value = -346;
    mockProgress.value = 1;

    const { result, rerender } = renderHook(() => useKeyboardLift());
    expect(result.current.value).toBe(-312);

    listeners.get('keyboardDidHide')!();
    rerender({});
    expect(result.current.value).toBe(0);

    listeners.get('keyboardDidShow')!();
    rerender({});
    expect(result.current.value).toBe(-312);
    spy.mockRestore();
  });

  it('drops the bar on return to the foreground when no keyboard is showing', () => {
    let onChange: ((state: string) => void) | undefined;
    const appSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation(((_: string, handler: (state: string) => void) => {
        onChange = handler;
        return { remove: jest.fn() };
      }) as unknown as typeof AppState.addEventListener);
    const visibleSpy = jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
    mockInsetsBottom = 34;
    mockHeight.value = -346;
    mockProgress.value = 1;

    const { result, rerender } = renderHook(() => useKeyboardLift());
    expect(result.current.value).toBe(-312);

    onChange!('active');
    rerender({});
    expect(result.current.value).toBe(0);
    appSpy.mockRestore();
    visibleSpy.mockRestore();
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
