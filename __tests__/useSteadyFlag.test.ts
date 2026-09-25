import { act, renderHook } from '@testing-library/react-native';
import { useSteadyFlag } from '../hooks/useSteadyFlag';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useSteadyFlag', () => {
  it('rises the moment the value does', () => {
    const { result, rerender } = renderHook<boolean, { value: boolean }>(
      ({ value }) => useSteadyFlag(value, 180),
      { initialProps: { value: false } }
    );

    rerender({ value: true });
    expect(result.current).toBe(true);
  });

  it('ignores a gap shorter than the hold', () => {
    const { result, rerender } = renderHook<boolean, { value: boolean }>(
      ({ value }) => useSteadyFlag(value, 180),
      { initialProps: { value: true } }
    );

    rerender({ value: false });
    act(() => {
      jest.advanceTimersByTime(60);
    });
    rerender({ value: true });
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current).toBe(true);
  });

  it('falls once the value has stayed false for the whole hold', () => {
    const { result, rerender } = renderHook<boolean, { value: boolean }>(
      ({ value }) => useSteadyFlag(value, 180),
      { initialProps: { value: true } }
    );

    rerender({ value: false });
    act(() => {
      jest.advanceTimersByTime(180);
    });

    expect(result.current).toBe(false);
  });
});
