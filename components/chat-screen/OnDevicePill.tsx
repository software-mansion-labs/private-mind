import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily } from '../../styles/fontStyles';
import { space } from '../../constants/design-system';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import {
  GLASS_BADGE_HEIGHT,
  GLASS_BADGE_LINE_HEIGHT,
  GLASS_BADGE_TEXT_SIZE,
} from '../../constants/glass-badge';
import { Glass } from '../Glass';
import LockIcon from '../../assets/icons/lock-solid.svg';
import { pressedOpacity } from '../../styles/pressable';
import { usePrivacySheetStore } from '../../store/privacySheetStore';
import { Feedback } from '../../utils/Feedback';

const LOCK_WIDTH = 10;
const LOCK_HEIGHT = 12;
const PILL_HIT_SLOP = 6;

export const ON_DEVICE_PILL = 'Private and offline, on your device';
export const ON_DEVICE_PILL_HEIGHT = GLASS_BADGE_HEIGHT;

export default function OnDevicePill() {
  const { styles, theme } = useThemedStyles(createStyles);
  const openPrivacySheet = usePrivacySheetStore(
    (state) => state.openPrivacySheet
  );

  return (
    <Glass
      radius={ON_DEVICE_PILL_HEIGHT / 2}
      fallbackTint={theme.bg.chatBar}
      style={styles.glass}
    >
      <Pressable
        onPress={() => {
          Feedback.sheetOpen();
          openPrivacySheet();
        }}
        style={({ pressed }) => [styles.pill, pressed && pressedOpacity]}
        hitSlop={PILL_HIT_SLOP}
        accessibilityRole="button"
        accessibilityHint="Shows how your chats stay private"
        testID="on-device-pill"
      >
        <LockIcon width={LOCK_WIDTH} height={LOCK_HEIGHT} style={styles.lock} />
        <Text
          style={styles.text}
          numberOfLines={1}
          maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
        >
          {ON_DEVICE_PILL}
        </Text>
      </Pressable>
    </Glass>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    glass: {
      flexShrink: 1,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
      height: ON_DEVICE_PILL_HEIGHT,
      gap: space.two,
      paddingHorizontal: space.three,
    },
    lock: {
      color: theme.text.accent,
    },
    text: {
      flexShrink: 1,
      fontFamily: fontFamily.regular,
      fontSize: GLASS_BADGE_TEXT_SIZE,
      lineHeight: GLASS_BADGE_LINE_HEIGHT,
      color: theme.text.primary,
    },
  });
