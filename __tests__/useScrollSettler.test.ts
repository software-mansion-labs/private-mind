import { act, renderHook } from '@testing-library/react-native';
import {
  SCROLL_SETTLE_STEPS,
  useScrollSettler,
} from '../components/chat-screen/useScrollSettler';

const LAST_STEP = SCROLL_SETTLE_STEPS[SCROLL_SETTLE_STEPS.length - 1];

const setup = () => {
  const snap = jest.fn();
  const { result, unmount } = renderHook(() => useScrollSettler(snap));
  return { snap, result, unmount };
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useScrollSettler', () => {
  it('snaps immediately, then re-snaps at every step', () => {
    const { snap, result } = setup();

    act(() => result.current.start());
    expect(snap).toHaveBeenCalledTimes(1);
    expect(snap).toHaveBeenLastCalledWith(true);

    act(() => jest.advanceTimersByTime(LAST_STEP.delay));

    expect(snap).toHaveBeenCalledTimes(1 + SCROLL_SETTLE_STEPS.length);
    expect(snap.mock.calls.slice(1)).toEqual(
      SCROLL_SETTLE_STEPS.map((step) => [step.animated])
    );
  });

  it('keeps the send transition animated, then corrects instantly', () => {
    const { snap, result } = setup();

    act(() => result.current.start());
    act(() => jest.advanceTimersByTime(220));
    expect(snap.mock.calls.every(([animated]) => animated === true)).toBe(true);

    snap.mockClear();
    act(() => jest.advanceTimersByTime(LAST_STEP.delay - 220));
    expect(snap).toHaveBeenCalled();
    expect(snap.mock.calls.every(([animated]) => animated === false)).toBe(
      true
    );
  });

  it('keeps re-snapping past the keyboard-dismiss animation', () => {
    const { snap, result } = setup();

    act(() => result.current.start());
    act(() => jest.advanceTimersByTime(300));
    const beforeTail = snap.mock.calls.length;

    act(() => jest.advanceTimersByTime(LAST_STEP.delay - 300));

    expect(snap.mock.calls.length).toBeGreaterThan(beforeTail);
  });

  it('stops re-snapping once cancelled', () => {
    const { snap, result } = setup();

    act(() => result.current.start());
    snap.mockClear();
    act(() => result.current.cancel());

    act(() => jest.advanceTimersByTime(LAST_STEP.delay * 2));

    expect(snap).not.toHaveBeenCalled();
    expect(result.current.isSettling()).toBe(false);
  });

  it('reports settling only inside the window', () => {
    const { result } = setup();

    expect(result.current.isSettling()).toBe(false);

    act(() => result.current.start());
    expect(result.current.isSettling()).toBe(true);

    act(() => jest.advanceTimersByTime(LAST_STEP.delay));
    expect(result.current.isSettling()).toBe(false);
  });

  it('resettles only while a pin is in flight', () => {
    const { snap, result } = setup();

    act(() => result.current.resettle());
    expect(snap).not.toHaveBeenCalled();

    act(() => result.current.start());
    snap.mockClear();
    act(() => result.current.resettle());
    expect(snap).toHaveBeenLastCalledWith(true);

    act(() => jest.advanceTimersByTime(340));
    snap.mockClear();
    act(() => result.current.resettle());
    expect(snap).toHaveBeenLastCalledWith(false);

    act(() => jest.advanceTimersByTime(LAST_STEP.delay));
    snap.mockClear();
    act(() => result.current.resettle());
    expect(snap).not.toHaveBeenCalled();
  });

  it('restarts cleanly when a second message is sent mid-window', () => {
    const { snap, result } = setup();

    act(() => result.current.start());
    act(() => jest.advanceTimersByTime(SCROLL_SETTLE_STEPS[0].delay));
    snap.mockClear();

    act(() => result.current.start());
    expect(snap).toHaveBeenLastCalledWith(true);

    snap.mockClear();
    act(() => jest.advanceTimersByTime(LAST_STEP.delay));
    expect(snap).toHaveBeenCalledTimes(SCROLL_SETTLE_STEPS.length);
  });

  it('drops pending timers on unmount', () => {
    const { snap, result, unmount } = setup();

    act(() => result.current.start());
    snap.mockClear();
    unmount();

    act(() => jest.advanceTimersByTime(LAST_STEP.delay * 2));

    expect(snap).not.toHaveBeenCalled();
  });
});
