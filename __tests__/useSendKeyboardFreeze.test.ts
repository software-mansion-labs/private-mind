import { act, renderHook } from '@testing-library/react-native';
import { useSendKeyboardFreeze } from '../components/chat-screen/useSendKeyboardFreeze';
import { PIN_FREEZE_FALLBACK_MS } from '../constants/chat-screen';
import type { SharedValue } from 'react-native-reanimated';

const shared = (value: number) =>
  ({ value, get: () => value }) as unknown as SharedValue<number>;

describe('useSendKeyboardFreeze', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts unfrozen', () => {
    const { result } = renderHook(() =>
      useSendKeyboardFreeze(shared(0), shared(0))
    );

    expect(result.current.frozen.value).toBe(false);
  });

  it('holds the freeze while the keyboard is still on its way down', () => {
    const lift = shared(-312);
    const { result, rerender } = renderHook(() =>
      useSendKeyboardFreeze(lift, shared(0))
    );

    act(() => result.current.arm());
    rerender({});

    expect(result.current.frozen.value).toBe(true);
  });

  it('holds the freeze while the bar is still shrinking back', () => {
    const extra = shared(40);
    const { result, rerender } = renderHook(() =>
      useSendKeyboardFreeze(shared(0), extra)
    );

    act(() => result.current.arm());
    rerender({});

    expect(result.current.frozen.value).toBe(true);
  });

  it('lets go once the keyboard is gone and the bar has settled', () => {
    const lift = shared(-312);
    const { result, rerender } = renderHook(() =>
      useSendKeyboardFreeze(lift, shared(0))
    );

    act(() => result.current.arm());
    lift.value = 0;
    rerender({});

    expect(result.current.frozen.value).toBe(false);
  });

  it('lets go on its own if the keyboard never reports closing', () => {
    const { result, rerender } = renderHook(() =>
      useSendKeyboardFreeze(shared(-312), shared(0))
    );

    act(() => result.current.arm());
    act(() => {
      jest.advanceTimersByTime(PIN_FREEZE_FALLBACK_MS);
    });
    rerender({});

    expect(result.current.frozen.value).toBe(false);
  });

  it('lets go at once when the send is cancelled', () => {
    const { result } = renderHook(() =>
      useSendKeyboardFreeze(shared(-312), shared(0))
    );

    act(() => result.current.arm());
    act(() => result.current.release());

    expect(result.current.frozen.value).toBe(false);
  });
});
