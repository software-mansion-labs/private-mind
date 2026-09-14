import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WebView } from 'react-native-webview';
import { buildSerpParserJs } from '../utils/web/scrape/serpParser';
import { parseSerpMessage } from '../utils/web/security/untrustedContent';
import { webViewScrapeProvider } from '../utils/web/scrape/webViewScrapeProvider';
import { isAllowedScrapeNavigation } from '../utils/web/security/scrapeNavigation';
import { useWebSearchStore } from '../store/webSearchStore';
import {
  SCRAPE_REINJECT_DELAY_MAX_MS,
  SCRAPE_REINJECT_DELAY_MIN_MS,
} from '../constants/web';

type Navigation = { uri: string; key: number; nonce: number };

export const useScrapeHost = () => {
  const webRef = useRef<WebView>(null);
  const reinjectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<Navigation | null>(null);
  const [nav, setNav] = useState<Navigation | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    navRef.current = nav;
  }, [nav]);

  const onLoadScript = useMemo(
    () => (nav ? buildSerpParserJs(false, nav.nonce) : undefined),
    [nav]
  );

  const inject = useCallback((reportEmpty: boolean) => {
    const current = navRef.current;
    if (!current) return;
    webRef.current?.injectJavaScript(
      buildSerpParserJs(reportEmpty, current.nonce)
    );
  }, []);

  const recheck = useCallback(() => inject(true), [inject]);

  const closeAndCancel = useCallback(() => {
    setRevealed(false);
    useWebSearchStore.getState().setChallengeActive(false);
    webViewScrapeProvider.cancelPending();
  }, []);

  const handleLoadEnd = useCallback(() => {
    if (!nav) return;
    if (reinjectTimer.current) clearTimeout(reinjectTimer.current);
    const scheduledKey = nav.key;
    const jitter =
      SCRAPE_REINJECT_DELAY_MIN_MS +
      Math.random() *
        (SCRAPE_REINJECT_DELAY_MAX_MS - SCRAPE_REINJECT_DELAY_MIN_MS);
    reinjectTimer.current = setTimeout(() => {
      if (navRef.current?.key !== scheduledKey) return;
      inject(!useWebSearchStore.getState().challengeActive);
    }, jitter);
  }, [nav, inject]);

  const handleNavigationStateChange = useCallback((state: { url: string }) => {
    if (navRef.current === null) return;
    if (isAllowedScrapeNavigation(state.url)) return;
    setNav(null);
    webViewScrapeProvider.skipEngine();
  }, []);

  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      const raw = event.nativeEvent.data;
      const message = parseSerpMessage(raw);
      if (message && message.type !== 'serp-challenge') {
        setRevealed(false);
        useWebSearchStore.getState().setChallengeActive(false);
      }
      webViewScrapeProvider.handleMessage(raw);
    },
    []
  );

  useEffect(() => {
    useWebSearchStore.getState().registerChallengeHandlers({
      open: () => setRevealed(true),
      cancel: closeAndCancel,
    });

    webViewScrapeProvider.attachHost({
      navigate: (uri, nonce) =>
        setNav((prev) => ({ uri, nonce, key: (prev?.key ?? 0) + 1 })),
      reset: () => setNav(null),
      onChallenge: () => {
        const current = useWebSearchStore.getState();
        if (current.challengePolicy === 'skip') {
          webViewScrapeProvider.skipEngine();
          return;
        }
        current.setChallengeActive(true);
        if (current.challengePolicy === 'reveal') setRevealed(true);
      },
    });

    return () => {
      if (reinjectTimer.current) clearTimeout(reinjectTimer.current);
      webViewScrapeProvider.detachHost();
      useWebSearchStore.getState().registerChallengeHandlers(null);
    };
  }, [closeAndCancel]);

  return {
    webRef,
    nav,
    onLoadScript,
    revealed,
    closeAndCancel,
    recheck,
    handleMessage,
    handleLoadEnd,
    handleNavigationStateChange,
  };
};
