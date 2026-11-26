import React, { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useReadAloudStore } from '../../store/readAloudStore';
import type { ReadAloudPlan } from '../../utils/readAloudPlan';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { pressedOpacity } from '../../styles/pressable';
import { space } from '../../constants/design-system';
import StopIcon from '../../assets/icons/pause_icon.svg';
import VolumeIcon from '../../assets/icons/volume.svg';

const ICON_SIZE = 16;
const STOP_ICON_SIZE = 12;
const BUTTON_SIZE = 24;
const BUTTON_RADIUS = 8;
const PERCENT = 100;

type ReadAloudButtonProps = {
  messageId: number;
  plan: ReadAloudPlan;
};

export default function ReadAloudButton({
  messageId,
  plan,
}: ReadAloudButtonProps) {
  const { styles, theme } = useThemedStyles(createStyles);
  const phase = useReadAloudStore((state) =>
    state.messageId === messageId ? state.phase : 'idle'
  );
  const downloadProgress = useReadAloudStore((state) => state.downloadProgress);
  const toggle = useReadAloudStore((state) => state.toggle);

  const handlePress = useCallback(() => {
    toggle(messageId, plan);
  }, [toggle, messageId, plan]);

  const renderGlyph = () => {
    if (phase === 'downloading') {
      return (
        <>
          <ActivityIndicator size="small" color={theme.text.primary} />
          <Text style={styles.percent}>
            {Math.round(downloadProgress * PERCENT)}%
          </Text>
        </>
      );
    }
    if (phase === 'preparing') {
      return <ActivityIndicator size="small" color={theme.text.primary} />;
    }
    if (phase === 'speaking') {
      return (
        <StopIcon
          width={STOP_ICON_SIZE}
          height={STOP_ICON_SIZE}
          style={styles.icon}
        />
      );
    }
    return (
      <VolumeIcon width={ICON_SIZE} height={ICON_SIZE} style={styles.icon} />
    );
  };

  const labels = {
    idle: 'Read aloud',
    downloading: 'Cancel download',
    preparing: 'Stop reading',
    speaking: 'Stop reading',
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        phase === 'downloading' && styles.buttonWithProgress,
        pressed && pressedOpacity,
      ]}
      onPress={handlePress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={labels[phase]}
      testID="read-aloud-button"
    >
      {renderGlyph()}
    </Pressable>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    button: {
      minWidth: BUTTON_SIZE,
      height: BUTTON_SIZE,
      borderRadius: BUTTON_RADIUS,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: space.one,
    },
    buttonWithProgress: {
      paddingHorizontal: space.one,
    },
    icon: {
      color: theme.text.primary,
    },
    percent: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      color: theme.text.primary,
    },
  });
