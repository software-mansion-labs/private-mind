import { renderHook, act } from '@testing-library/react-native';

jest.mock('../utils/web/scrape/webViewScrapeProvider', () => ({
  webViewScrapeProvider: {
    attachHost: jest.fn(),
    detachHost: jest.fn(),
    handleMessage: jest.fn(),
    cancelPending: jest.fn(),
  },
}));

jest.mock('../utils/web/scrape/serpParser', () => ({
  SERP_PARSER_JS: 'PARSER_JS',
  parseSerpMessage: jest.fn(),
}));

import { useScrapeHost } from '../hooks/useScrapeHost';
import { webViewScrapeProvider } from '../utils/web/scrape/webViewScrapeProvider';
import { parseSerpMessage } from '../utils/web/scrape/serpParser';
import { useWebSearchStore } from '../store/webSearchStore';

const attachHost = webViewScrapeProvider.attachHost as jest.Mock;
const detachHost = webViewScrapeProvider.detachHost as jest.Mock;
const providerHandleMessage = webViewScrapeProvider.handleMessage as jest.Mock;
const cancelPending = webViewScrapeProvider.cancelPending as jest.Mock;

const registeredHost = () => attachHost.mock.calls[0]![0];

beforeEach(() => {
  jest.clearAllMocks();
  useWebSearchStore.setState({
    challengeActive: false,
    challengeHandlers: null,
  });
  useWebSearchStore.getState().updateChallengePolicy('ask');
});

describe('useScrapeHost', () => {
  it('attaches the provider host and registers challenge handlers on mount', () => {
    renderHook(() => useScrapeHost());

    expect(attachHost).toHaveBeenCalledTimes(1);
    expect(useWebSearchStore.getState().challengeHandlers).not.toBeNull();
  });

  it('detaches and unregisters handlers on unmount', () => {
    const { unmount } = renderHook(() => useScrapeHost());

    unmount();

    expect(detachHost).toHaveBeenCalledTimes(1);
    expect(useWebSearchStore.getState().challengeHandlers).toBeNull();
  });

  it('reveals fullscreen on a challenge when the policy is reveal', () => {
    useWebSearchStore.getState().updateChallengePolicy('reveal');
    const { result } = renderHook(() => useScrapeHost());

    act(() => registeredHost().onChallenge());

    expect(result.current.revealed).toBe(true);
    expect(useWebSearchStore.getState().challengeActive).toBe(true);
  });

  it('cancels the fetch on a challenge when the policy is skip, without revealing', () => {
    useWebSearchStore.getState().updateChallengePolicy('skip');
    const { result } = renderHook(() => useScrapeHost());

    act(() => registeredHost().onChallenge());

    expect(cancelPending).toHaveBeenCalledTimes(1);
    expect(result.current.revealed).toBe(false);
  });

  it('flags the challenge active but stays hidden when the policy is ask', () => {
    const { result } = renderHook(() => useScrapeHost());

    act(() => registeredHost().onChallenge());

    expect(useWebSearchStore.getState().challengeActive).toBe(true);
    expect(result.current.revealed).toBe(false);
  });

  it('hides and clears the challenge flag on a non-challenge message', () => {
    (parseSerpMessage as jest.Mock).mockReturnValue({ type: 'serp-results' });
    useWebSearchStore.setState({ challengeActive: true });
    const { result } = renderHook(() => useScrapeHost());

    act(() => result.current.handleMessage({ nativeEvent: { data: 'raw' } }));

    expect(useWebSearchStore.getState().challengeActive).toBe(false);
    expect(providerHandleMessage).toHaveBeenCalledWith('raw');
  });

  it('keeps the challenge visible on a challenge message but still forwards it', () => {
    (parseSerpMessage as jest.Mock).mockReturnValue({ type: 'serp-challenge' });
    useWebSearchStore.setState({ challengeActive: true });
    const { result } = renderHook(() => useScrapeHost());

    act(() => result.current.handleMessage({ nativeEvent: { data: 'raw' } }));

    expect(useWebSearchStore.getState().challengeActive).toBe(true);
    expect(providerHandleMessage).toHaveBeenCalledWith('raw');
  });

  it('closeAndCancel hides, clears the flag and cancels the pending fetch', () => {
    useWebSearchStore.setState({ challengeActive: true });
    const { result } = renderHook(() => useScrapeHost());

    act(() => result.current.closeAndCancel());

    expect(result.current.revealed).toBe(false);
    expect(useWebSearchStore.getState().challengeActive).toBe(false);
    expect(cancelPending).toHaveBeenCalledTimes(1);
  });
});
