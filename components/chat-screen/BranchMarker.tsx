import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ChatBranchMarker } from '../../database/chatRepository';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import ForkIcon from '../../assets/icons/fork.svg';

type BranchMarkerProps = {
  marker: ChatBranchMarker;
  onPress?: (marker: ChatBranchMarker) => void;
};

export default function BranchMarker({ marker, onPress }: BranchMarkerProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <Pressable
        style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
        onPress={() => onPress?.(marker)}
        accessibilityRole="button"
        accessibilityLabel={`Open source conversation: ${marker.sourceChatTitle}`}
      >
        <ForkIcon width={14} height={14} style={styles.icon} />
        <Text style={styles.text} numberOfLines={1}>
          Branched from:{' '}
          <Text style={styles.sourceTitle}>
            {marker.sourceChatTitle || 'source conversation'}
          </Text>
        </Text>
      </Pressable>
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
    link: {
      maxWidth: '78%',
      minHeight: 32,
      paddingHorizontal: 10,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    linkPressed: {
      opacity: 0.6,
    },
    icon: {
      color: theme.text.primary,
    },
    text: {
      flexShrink: 1,
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      color: theme.text.defaultSecondary,
      lineHeight: lineHeights.xs,
    },
    sourceTitle: {
      color: theme.text.primary,
      textDecorationLine: 'underline',
    },
  });
