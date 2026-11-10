import { act, renderHook } from '@testing-library/react-native';
import { KeyboardController } from 'react-native-keyboard-controller';
import { useAttachmentPanel } from '../components/chat-screen/attachments/useAttachmentPanel';
import { DURATION } from '../components/chat-screen/attachments/constants';

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated'),
  useSharedValue: (initial: number) => {
    let value = initial;
    return { get: () => value, set: (next: number) => (value = next) };
  },
  withSpring: (
    to: number,
    _config: unknown,
    onDone?: (finished: boolean) => void
  ) => {
    onDone?.(true);
    return to;
  },
  withTiming: (to: number) => to,
  withDelay: (_delay: number, value: number) => value,
  withSequence: (...values: number[]) => values[values.length - 1],
}));

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) =>
    fn(...args),
}));

jest.mock('../utils/Feedback', () => ({
  Feedback: new Proxy({}, { get: () => jest.fn() }),
}));

const openPanel = () => {
  const view = renderHook(() => useAttachmentPanel());
  act(() => view.result.current.onPlusPress());
  act(() => {
    jest.advanceTimersByTime(DURATION.plusLead);
  });
  expect(view.result.current.mode).toBe('menu');
  jest.mocked(KeyboardController.setFocusTo).mockClear();
  return view;
};

describe('closing the attachment panel', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('gives the keyboard back to the composer when the user closes it', () => {
    const { result } = openPanel();
    act(() => result.current.dismiss());
    expect(result.current.mode).toBe('closed');
    expect(KeyboardController.setFocusTo).toHaveBeenCalledWith('current');
  });

  it('keeps the keyboard down when another sheet takes over the screen', () => {
    const { result } = openPanel();
    act(() => result.current.dismissWithoutRefocus());
    expect(result.current.mode).toBe('closed');
    expect(KeyboardController.setFocusTo).not.toHaveBeenCalled();
  });

  it('refocuses again on the next ordinary close after a hand-off', () => {
    const { result } = openPanel();
    act(() => result.current.dismissWithoutRefocus());
    act(() => result.current.onPlusPress());
    act(() => {
      jest.advanceTimersByTime(DURATION.plusLead);
    });
    act(() => result.current.dismiss());
    expect(KeyboardController.setFocusTo).toHaveBeenCalledTimes(1);
  });
});
