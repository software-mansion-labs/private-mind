import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import LinkIcon from '../../assets/icons/link-alt.svg';
import { hostname } from '../../utils/web/webResultsToContext';
import { WEB_FAVICON_URL } from '../../constants/web';

interface Props {
  url: string;
  size: number;
}

const RETRY_DELAYS_MS = [2000, 6000];

const WebFavicon = ({ url, size }: Props) => {
  const { theme } = useTheme();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const host = hostname(url);
  const source = useMemo(
    () => ({
      uri: attempt
        ? `${WEB_FAVICON_URL(host)}?retry=${attempt}`
        : WEB_FAVICON_URL(host),
    }),
    [host, attempt]
  );

  const progress = useSharedValue(0);
  useEffect(() => {
    setFailed(false);
    setAttempt(0);
    progress.set(0);
  }, [host, progress]);
  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    []
  );
  const faviconStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: 0.82 + progress.get() * 0.18 }],
  }));
  const fallbackStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.get(),
  }));
  const handleLoad = useCallback(() => {
    progress.set(withTiming(1, { duration: 220 }));
  }, [progress]);
  const handleError = useCallback(() => {
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay === undefined) {
      setFailed(true);
      return;
    }
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => setAttempt(attempt + 1), delay);
  }, [attempt]);

  const fallback = (
    <LinkIcon
      width={size}
      height={size}
      style={{ color: theme.text.defaultSecondary }}
    />
  );
  if (!host || host === url) return fallback;

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, fallbackStyle]}>
        {fallback}
      </Animated.View>
      {!failed && (
        <Animated.Image
          key={attempt}
          source={source}
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: size * 0.2 },
            faviconStyle,
          ]}
          onLoad={handleLoad}
          onError={handleError}
          testID="web-favicon"
        />
      )}
    </View>
  );
};

export default WebFavicon;
