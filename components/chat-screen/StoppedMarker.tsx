import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import RotateLeftIcon from '../../assets/icons/rotate_left.svg';

type StoppedMarkerProps = {
  onRetry?: () => void;
};

export default function StoppedMarker({ onRetry }: StoppedMarkerProps) {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.container} testID="stopped-marker">
      <View style={styles.line} />
      <View style={styles.content}>
        <Text style={styles.text} numberOfLines={2}>
          You stopped this response
        </Text>
        {onRetry && (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry this response"
            style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
          >
            <RotateLeftIcon width={14} height={14} style={styles.icon} />
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.line} />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: -10,
      marginBottom: 18,
    },
    line: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border.soft,
    },
    content: {
      maxWidth: '82%',
      minHeight: 32,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    text: {
      flexShrink: 1,
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      color: theme.text.defaultSecondary,
      lineHeight: lineHeights.xs,
    },
    retry: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 16,
      backgroundColor: theme.bg.softSecondary,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    pressed: {
      opacity: 0.6,
    },
    icon: {
      color: theme.text.primary,
    },
    retryText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      color: theme.text.primary,
      lineHeight: lineHeights.xs,
    },
  });
