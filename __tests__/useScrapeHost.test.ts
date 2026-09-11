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
  buildSerpParserJs: (reportEmpty: boolean, nonce?: number) =>
    `PARSER:${reportEmpty}:${nonce}`,
}));

jest.mock('../utils/web/security/untrustedContent', () => ({
  parseSerpMessage: jest.fn(),
}));

import { useScrapeHost } from '../hooks/useScrapeHost';
import { webViewScrapeProvider } from '../utils/web/scrape/webViewScrapeProvider';
import { parseSerpMessage } from '../utils/web/security/untrustedContent';
import { useWebSearchStore } from '../store/webSearchStore';
import { SCRAPE_REINJECT_DELAY_MAX_MS } from '../constants/web';
import type { WebView } from 'react-native-webview';

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
      registeredHost().navigate('https://html.duckduckgo.com/html/?q=x', 1)
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
      registeredHost().navigate('https://html.duckduckgo.com/html/?q=x', 1)
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

describe('useScrapeHost — parser injection', () => {
  const SERP = 'https://html.duckduckgo.com/html/?q=x';

  const mountWithWebView = () => {
    const injectJavaScript = jest.fn();
    const view = renderHook(() => useScrapeHost());
    view.result.current.webRef.current = {
      injectJavaScript,
    } as unknown as WebView;
    return { view, injectJavaScript };
  };

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('builds the on-load parser for the current navigation, without empty reporting', () => {
    const { result } = renderHook(() => useScrapeHost());
    expect(result.current.onLoadScript).toBeUndefined();

    act(() => registeredHost().navigate(SERP, 7));

    expect(result.current.onLoadScript).toBe('PARSER:false:7');
  });

  it('reports an empty page when the user presses Done', () => {
    const { view, injectJavaScript } = mountWithWebView();
    act(() => registeredHost().navigate(SERP, 3));

    act(() => view.result.current.recheck());

    expect(injectJavaScript).toHaveBeenCalledWith('PARSER:true:3');
  });

  it('rechecks with empty reporting after a page load when no challenge is up', async () => {
    const { view, injectJavaScript } = mountWithWebView();
    act(() => registeredHost().navigate(SERP, 3));

    act(() => view.result.current.handleLoadEnd());
    jest.advanceTimersByTime(SCRAPE_REINJECT_DELAY_MAX_MS);

    expect(injectJavaScript).toHaveBeenCalledWith('PARSER:true:3');
  });

  it('rechecks silently after a page load while a challenge is up', async () => {
    const { view, injectJavaScript } = mountWithWebView();
    act(() => registeredHost().navigate(SERP, 3));
    useWebSearchStore.setState({ challengeActive: true });

    act(() => view.result.current.handleLoadEnd());
    jest.advanceTimersByTime(SCRAPE_REINJECT_DELAY_MAX_MS);

    expect(injectJavaScript).toHaveBeenCalledWith('PARSER:false:3');
  });

  it('drops a scheduled recheck once the navigation moved on', async () => {
    const { view, injectJavaScript } = mountWithWebView();
    act(() => registeredHost().navigate(SERP, 3));
    act(() => view.result.current.handleLoadEnd());

    act(() => registeredHost().reset());
    jest.advanceTimersByTime(SCRAPE_REINJECT_DELAY_MAX_MS);

    expect(injectJavaScript).not.toHaveBeenCalled();
  });
});
