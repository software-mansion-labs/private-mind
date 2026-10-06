import { BackHandler } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { useBackToClose } from '../hooks/useBackToClose';

const listenToBack = () => {
  const handlers: (() => boolean)[] = [];
  const remove = jest.fn();
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, handler) => {
      handlers.push(handler as () => boolean);
      return { remove } as unknown as ReturnType<
        typeof BackHandler.addEventListener
      >;
    });
  return { press: () => handlers.at(-1)?.(), handlers, remove };
};

afterEach(() => jest.restoreAllMocks());

describe('useBackToClose', () => {
  it('closes what is open and keeps Back from leaving the screen', () => {
    const back = listenToBack();
    const close = jest.fn();
    renderHook(() => useBackToClose(true, close));

    expect(back.press()).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('leaves Back alone while nothing is open', () => {
    const back = listenToBack();
    renderHook(() => useBackToClose(false, jest.fn()));

    expect(back.handlers).toHaveLength(0);
  });

  it('lets Back go once the overlay has closed', () => {
    const back = listenToBack();
    const { rerender } = renderHook(
      ({ open }: { open: boolean }) => useBackToClose(open, jest.fn()),
      { initialProps: { open: true } }
    );

    rerender({ open: false });

    expect(back.remove).toHaveBeenCalledTimes(1);
  });
});
