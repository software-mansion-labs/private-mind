import { renderHook, act } from '@testing-library/react-native';

jest.mock('../utils/web/scrape/webViewScrapeProvider', () => ({
  webViewScrapeProvider: {
    attachHost: jest.fn(),
    detachHost: jest.fn(),
    handleMessage: jest.fn(),
    cancelPending: jest.fn(),
    skipEngine: jest.fn(),
  },
}));

jest.mock('../utils/web/scrape/serpParser', () => ({
  SERP_PARSER_JS: 'PARSER_JS',
}));

jest.mock('../utils/web/security/untrustedContent', () => ({
  parseSerpMessage: jest.fn(),
}));

import { useScrapeHost } from '../hooks/useScrapeHost';
import { webViewScrapeProvider } from '../utils/web/scrape/webViewScrapeProvider';
import { parseSerpMessage } from '../utils/web/security/untrustedContent';
import { useWebSearchStore } from '../store/webSearchStore';

const attachHost = webViewScrapeProvider.attachHost as jest.Mock;
const detachHost = webViewScrapeProvider.detachHost as jest.Mock;
const providerHandleMessage = webViewScrapeProvider.handleMessage as jest.Mock;
const cancelPending = webViewScrapeProvider.cancelPending as jest.Mock;
const skipEngine = webViewScrapeProvider.skipEngine as jest.Mock;

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

  it('skips the blocked engine on a challenge when the policy is skip, without revealing', () => {
    useWebSearchStore.getState().updateChallengePolicy('skip');
    const { result } = renderHook(() => useScrapeHost());

    act(() => registeredHost().onChallenge());

    expect(skipEngine).toHaveBeenCalledTimes(1);
    expect(cancelPending).not.toHaveBeenCalled();
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

  it('resets the WebView and skips the engine when a page navigates off the allowlist', () => {
    const { result } = renderHook(() => useScrapeHost());
    act(() =>
      registeredHost().navigate('https://html.duckduckgo.com/html/?q=x')
    );
    expect(result.current.nav?.uri).toContain('duckduckgo.com');

    act(() =>
      result.current.handleNavigationStateChange({
        url: 'https://evil.example/collect',
      })
    );

    expect(result.current.nav).toBeNull();
    expect(skipEngine).toHaveBeenCalledTimes(1);
  });

  it('leaves an allowed navigation alone', () => {
    const { result } = renderHook(() => useScrapeHost());
    act(() =>
      registeredHost().navigate('https://html.duckduckgo.com/html/?q=x')
    );
    act(() =>
      result.current.handleNavigationStateChange({
        url: 'https://duckduckgo.com/?q=x',
      })
    );
    expect(result.current.nav).not.toBeNull();
    expect(skipEngine).not.toHaveBeenCalled();
  });

  it('ignores navigation reports while idle', () => {
    const { result } = renderHook(() => useScrapeHost());
    act(() =>
      result.current.handleNavigationStateChange({ url: 'about:blank' })
    );
    expect(skipEngine).not.toHaveBeenCalled();
  });
});
