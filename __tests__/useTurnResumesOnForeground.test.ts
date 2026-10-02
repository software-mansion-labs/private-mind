import { AppState, type AppStateStatus } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { useTurnResumesOnForeground } from '../hooks/useTurnResumesOnForeground';

const mockLlm = {
  appLeftForeground: jest.fn(),
  appWentToBackground: jest.fn(),
  appReturnedToForeground: jest.fn(),
};

jest.mock('../store/llmStore', () => ({
  useLLMStore: { getState: () => mockLlm },
}));

const listenToAppState = () => {
  const remove = jest.fn();
  let listener: (state: AppStateStatus) => void = () => {};
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, handler) => {
    listener = handler as (state: AppStateStatus) => void;
    return { remove } as unknown as ReturnType<
      typeof AppState.addEventListener
    >;
  });
  return { emit: (state: AppStateStatus) => listener(state), remove };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useTurnResumesOnForeground', () => {
  it('tells the store the app left when it goes inactive, without sending it to the background', () => {
    const appState = listenToAppState();
    renderHook(() => useTurnResumesOnForeground());

    appState.emit('inactive');

    expect(mockLlm.appLeftForeground).toHaveBeenCalledTimes(1);
    expect(mockLlm.appWentToBackground).not.toHaveBeenCalled();
    expect(mockLlm.appReturnedToForeground).not.toHaveBeenCalled();
  });

  it('tells the store the app went to the background', () => {
    const appState = listenToAppState();
    renderHook(() => useTurnResumesOnForeground());

    appState.emit('background');

    expect(mockLlm.appWentToBackground).toHaveBeenCalledTimes(1);
    expect(mockLlm.appReturnedToForeground).not.toHaveBeenCalled();
  });

  it('tells the store the app is back when it turns active', () => {
    const appState = listenToAppState();
    renderHook(() => useTurnResumesOnForeground());

    appState.emit('active');

    expect(mockLlm.appReturnedToForeground).toHaveBeenCalledTimes(1);
    expect(mockLlm.appLeftForeground).not.toHaveBeenCalled();
  });

  it('stops listening when it unmounts', () => {
    const appState = listenToAppState();
    const { unmount } = renderHook(() => useTurnResumesOnForeground());

    unmount();

    expect(appState.remove).toHaveBeenCalledTimes(1);
  });
});
