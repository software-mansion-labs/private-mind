import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useModelSwitch } from '../components/chat-screen/useModelSwitch';
import { Model } from '../database/modelRepository';

const makeModel = (id: number): Model =>
  ({ id, modelName: `Model-${id}`, isDownloaded: true }) as Model;

const flushFrames = async () => {
  await act(async () => {
    jest.advanceTimersByTime(64);
  });
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useModelSwitch', () => {
  it('does not load while the sheet is still closing', async () => {
    const loadModel = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useModelSwitch(loadModel));

    act(() => result.current.pickModel(makeModel(1)));

    expect(loadModel).not.toHaveBeenCalled();
    expect(result.current.isSwitching).toBe(true);
    expect(result.current.pendingModel).toEqual(
      expect.objectContaining({ id: 1 })
    );
  });

  it('loads once the dismissal completes', async () => {
    const loadModel = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useModelSwitch(loadModel));

    act(() => result.current.pickModel(makeModel(1)));
    act(() => result.current.handleSheetStateChange(false));
    await flushFrames();

    await waitFor(() =>
      expect(loadModel).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
    );
  });

  it('returns to idle when the load settles', async () => {
    const loadModel = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useModelSwitch(loadModel));

    act(() => result.current.pickModel(makeModel(1)));
    act(() => result.current.handleSheetStateChange(false));
    await flushFrames();

    await waitFor(() => expect(result.current.isSwitching).toBe(false));
    expect(result.current.pendingModel).toBeUndefined();
  });

  it('returns to idle when the load rejects', async () => {
    const loadModel = jest.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useModelSwitch(loadModel));

    act(() => result.current.pickModel(makeModel(1)));
    act(() => result.current.handleSheetStateChange(false));
    await flushFrames();

    await waitFor(() => expect(result.current.isSwitching).toBe(false));
  });

  it('abandons the pick when the dismissal is interrupted and the sheet reopens', async () => {
    const loadModel = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useModelSwitch(loadModel));

    act(() => result.current.pickModel(makeModel(1)));
    act(() => result.current.handleSheetStateChange(true));
    await flushFrames();

    expect(result.current.isSwitching).toBe(false);
    expect(loadModel).not.toHaveBeenCalled();
  });

  it('releases a pick whose dismissal never completes', async () => {
    const loadModel = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useModelSwitch(loadModel));

    act(() => result.current.pickModel(makeModel(1)));
    expect(result.current.isSwitching).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.isSwitching).toBe(false);
    expect(loadModel).not.toHaveBeenCalled();
  });

  it('ignores a second pick while one is already in flight', async () => {
    const loadModel = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useModelSwitch(loadModel));

    act(() => result.current.pickModel(makeModel(1)));
    act(() => result.current.pickModel(makeModel(2)));

    expect(result.current.pendingModel).toEqual(
      expect.objectContaining({ id: 1 })
    );
  });

  it('does not load after unmount', async () => {
    const loadModel = jest.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useModelSwitch(loadModel));

    act(() => result.current.pickModel(makeModel(1)));
    act(() => result.current.handleSheetStateChange(false));
    unmount();
    await flushFrames();

    expect(loadModel).not.toHaveBeenCalled();
  });
});
