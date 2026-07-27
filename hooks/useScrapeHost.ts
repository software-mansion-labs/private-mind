import { useCallback, useEffect, useRef, useState } from 'react';
import type { WebView } from 'react-native-webview';
import {
  SERP_PARSER_JS,
  parseSerpMessage,
} from '../utils/web/scrape/serpParser';
import { webViewScrapeProvider } from '../utils/web/scrape/webViewScrapeProvider';
import { useWebSearchStore } from '../store/webSearchStore';
import {
  SCRAPE_REINJECT_DELAY_MAX_MS,
  SCRAPE_REINJECT_DELAY_MIN_MS,
} from '../constants/web';

type Navigation = { uri: string; key: number };

export const useScrapeHost = () => {
  const webRef = useRef<WebView>(null);
  const reinjectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navKeyRef = useRef<number | null>(null);
  const [nav, setNav] = useState<Navigation | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    navKeyRef.current = nav?.key ?? null;
  }, [nav?.key]);

  const recheck = useCallback(() => {
    webRef.current?.injectJavaScript(SERP_PARSER_JS);
  }, []);

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
      if (navKeyRef.current === scheduledKey) recheck();
    }, jitter);
  }, [nav, recheck]);

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
      navigate: (uri) => setNav((prev) => ({ uri, key: (prev?.key ?? 0) + 1 })),
      recheck,
      onChallenge: () => {
        const current = useWebSearchStore.getState();
        if (current.challengePolicy === 'skip') {
          webViewScrapeProvider.cancelPending();
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
  }, [closeAndCancel, recheck]);

  return {
    webRef,
    nav,
    revealed,
    closeAndCancel,
    recheck,
    handleMessage,
    handleLoadEnd,
  };
};
