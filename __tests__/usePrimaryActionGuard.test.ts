import { renderHook } from '@testing-library/react-native';
import {
  usePrimaryActionGuard,
  type PrimaryAction,
} from '../components/chat-screen/usePrimaryActionGuard';

describe('usePrimaryActionGuard', () => {
  let now = 0;

  beforeEach(() => {
    now = 10_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const renderGuard = (action: PrimaryAction) =>
    renderHook(
      ({ current }: { current: PrimaryAction }) =>
        usePrimaryActionGuard(current),
      { initialProps: { current: action } }
    );

  it('runs the first press', () => {
    const press = jest.fn();
    const { result } = renderGuard('send');

    result.current(press);

    expect(press).toHaveBeenCalledTimes(1);
  });

  it('ignores a second press that lands while the button is still swapping', () => {
    const press = jest.fn();
    const { result, rerender } = renderGuard('send');

    result.current(press);
    now += 216;
    rerender({ current: 'stop' });
    result.current(press);

    expect(press).toHaveBeenCalledTimes(1);
  });

  it('absorbs a sustained burst, however long it runs', () => {
    const press = jest.fn();
    const { result, rerender } = renderGuard('send');

    result.current(press);
    now += 60;
    rerender({ current: 'stop' });
    for (let tap = 0; tap < 12; tap += 1) {
      now += 170;
      result.current(press);
      if (tap === 3) rerender({ current: 'voice' });
    }

    expect(press).toHaveBeenCalledTimes(1);
  });

  it('runs a press once the button has stopped swapping', () => {
    const press = jest.fn();
    const { result, rerender } = renderGuard('send');

    result.current(press);
    now += 100;
    rerender({ current: 'stop' });
    now += 600;
    result.current(press);

    expect(press).toHaveBeenCalledTimes(2);
  });

  it('runs a deliberate stop on a turn that has been running', () => {
    const press = jest.fn();
    const { result, rerender } = renderGuard('send');

    result.current(press);
    now += 50;
    rerender({ current: 'stop' });
    now += 5_000;
    result.current(press);

    expect(press).toHaveBeenCalledTimes(2);
  });

  it('runs a send that follows the composer being filled from elsewhere', () => {
    const press = jest.fn();
    const { result, rerender } = renderGuard('voice');

    now += 4_000;
    rerender({ current: 'send' });
    result.current(press);

    expect(press).toHaveBeenCalledTimes(1);
  });
});
