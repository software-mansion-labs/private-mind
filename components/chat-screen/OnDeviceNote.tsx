import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { space } from '../../constants/design-system';
import LockIcon from '../../assets/icons/lock-solid.svg';
import { pressedOpacity } from '../../styles/pressable';
import { usePrivacySheetStore } from '../../store/privacySheetStore';
import { Feedback } from '../../utils/Feedback';

const LOCK_WIDTH = 10;
const LOCK_HEIGHT = 12;
const NOTE_MAX_WIDTH = 260;

export const ON_DEVICE_NOTE =
  'Everything happens on your device, even offline.';
export const LEARN_MORE = 'Learn\u00a0more';

export default function OnDeviceNote() {
  const { styles } = useThemedStyles(createStyles);
  const openPrivacySheet = usePrivacySheetStore(
    (state) => state.openPrivacySheet
  );

  return (
    <Pressable
      onPress={() => {
        Feedback.sheetOpen();
        openPrivacySheet();
      }}
      style={({ pressed }) => [styles.note, pressed && pressedOpacity]}
      accessibilityRole="button"
      accessibilityLabel={`${ON_DEVICE_NOTE} ${LEARN_MORE}`}
      accessibilityHint="Shows how your chats stay private"
      testID="on-device-note"
    >
      <LockIcon width={LOCK_WIDTH} height={LOCK_HEIGHT} style={styles.lock} />
      <Text style={styles.text}>
        {ON_DEVICE_NOTE} <Text style={styles.link}>{LEARN_MORE}</Text>
      </Text>
    </Pressable>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    note: {
      alignSelf: 'center',
      maxWidth: NOTE_MAX_WIDTH,
      alignItems: 'center',
      gap: space.one + space.half,
      marginBottom: space.six,
    },
    lock: {
      color: theme.text.accent,
    },
    text: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      color: theme.text.defaultTertiary,
      textAlign: 'center',
    },
    link: {
      fontFamily: fontFamily.medium,
      color: theme.text.accent,
    },
  });
