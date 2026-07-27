import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

const WebFavicon = ({ url, size }: Props) => {
  const { theme } = useTheme();
  const [failed, setFailed] = useState(false);
  const host = hostname(url);
  const source = useMemo(() => ({ uri: WEB_FAVICON_URL(host) }), [host]);

  const progress = useSharedValue(0);
  useEffect(() => {
    setFailed(false);
    progress.set(0);
  }, [host, progress]);
  const faviconStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: 0.82 + progress.get() * 0.18 }],
  }));
  const handleLoad = useCallback(() => {
    progress.set(withTiming(1, { duration: 220 }));
  }, [progress]);

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
      <View style={StyleSheet.absoluteFill}>{fallback}</View>
      {!failed && (
        <Animated.Image
          source={source}
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: size * 0.2 },
            faviconStyle,
          ]}
          onLoad={handleLoad}
          onError={() => setFailed(true)}
          testID="web-favicon"
        />
      )}
    </View>
  );
};

export default WebFavicon;
