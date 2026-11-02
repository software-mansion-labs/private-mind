import { renderHook } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { useBackToDismiss } from '../hooks/useBackToDismiss';

const remove = jest.fn();

const pressBack = () => {
  const spy = BackHandler.addEventListener as jest.Mock;
  const handler = spy.mock.calls.at(-1)?.[1] as (() => boolean) | undefined;
  return handler?.();
};

beforeEach(() => {
  remove.mockClear();
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockReturnValue({ remove } as never);
});

afterEach(() => jest.restoreAllMocks());

describe('useBackToDismiss', () => {
  it('leaves back to the screen while nothing is open', () => {
    renderHook(() => useBackToDismiss(false, jest.fn()));
    expect(BackHandler.addEventListener).not.toHaveBeenCalled();
  });

  it('spends back on closing what is open instead of leaving the screen', () => {
    const onBack = jest.fn();
    renderHook(() => useBackToDismiss(true, onBack));

    expect(pressBack()).toBe(true);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('runs the latest handler without re-subscribing', () => {
    const first = jest.fn();
    const latest = jest.fn();
    const { rerender } = renderHook(
      ({ onBack }: { onBack: () => void }) => useBackToDismiss(true, onBack),
      { initialProps: { onBack: first } }
    );
    rerender({ onBack: latest });

    pressBack();

    expect(BackHandler.addEventListener).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
  });

  it('hands back to the screen once closed', () => {
    const { rerender } = renderHook(
      ({ active }: { active: boolean }) => useBackToDismiss(active, jest.fn()),
      { initialProps: { active: true } }
    );
    rerender({ active: false });
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
