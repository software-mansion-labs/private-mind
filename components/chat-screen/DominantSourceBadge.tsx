import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { type SourceDocument } from '../../database/chatRepository';
import WebFavicon from './WebFavicon';

interface Props {
  source?: SourceDocument;
}

const DominantSourceBadge = ({ source }: Props) => {
  const { styles } = useThemedStyles(createStyles);

  const handlePress = useCallback(() => {
    if (!source?.url) return;
    WebBrowser.openBrowserAsync(source.url).catch((error) =>
      console.warn('Failed to open browser', error)
    );
  }, [source?.url]);

  if (!source) return null;

  return (
    <Pressable
      style={({ pressed }) => [styles.badge, pressed && styles.badgePressed]}
      onPress={handlePress}
      disabled={!source.url}
      hitSlop={4}
      accessibilityRole={source.url ? 'button' : undefined}
      testID="dominant-source-badge"
    >
      {source.url ? (
        <WebFavicon url={source.url} size={14} />
      ) : (
        <View style={styles.dot} />
      )}
      <Text style={styles.text} numberOfLines={1}>
        Source: {source.name}
      </Text>
    </Pressable>
  );
};

export default DominantSourceBadge;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      marginTop: 6,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 9999,
      backgroundColor: theme.bg.softSecondary,
      borderWidth: 1,
      borderColor: theme.border.soft,
    },
    badgePressed: {
      opacity: 0.7,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.text.defaultTertiary,
    },
    text: {
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
      flexShrink: 1,
    },
  });
