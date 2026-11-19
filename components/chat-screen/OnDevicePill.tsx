import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import {
  GLASS_BUTTON_SIZE,
  TITLE_CAPSULE_PADDING,
  TITLE_SHIELD_GAP,
  TITLE_SHIELD_HEIGHT,
  TITLE_SHIELD_WIDTH,
} from '../../constants/header-actions';
import { Glass } from '../Glass';
import ShieldIcon from '../../assets/icons/shield-check.svg';
import { pressedOpacity } from '../../styles/pressable';
import { usePrivacySheetStore } from '../../store/privacySheetStore';
import { Feedback } from '../../utils/Feedback';

export const ON_DEVICE_PILL = 'Private and offline';

interface Props {
  reveal?: SharedValue<number>;
}

export default function OnDevicePill({ reveal }: Props) {
  const { styles } = useThemedStyles(createStyles);
  const openPrivacySheet = usePrivacySheetStore(
    (state) => state.openPrivacySheet
  );
  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal ? reveal.get() : 1,
  }));

  return (
    <Animated.View
      style={[styles.reveal, revealStyle]}
      testID="on-device-pill-reveal"
    >
      <Glass radius={GLASS_BUTTON_SIZE / 2} style={styles.capsule}>
        <Pressable
          onPress={() => {
            Feedback.sheetOpen();
            openPrivacySheet();
          }}
          style={({ pressed }) => [styles.pill, pressed && pressedOpacity]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityHint="Shows how your chats stay private"
          testID="on-device-pill"
        >
          <ShieldIcon
            width={TITLE_SHIELD_WIDTH}
            height={TITLE_SHIELD_HEIGHT}
            style={styles.shield}
          />
          <Text
            style={styles.text}
            numberOfLines={1}
            maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
          >
            {ON_DEVICE_PILL}
          </Text>
        </Pressable>
      </Glass>
    </Animated.View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    reveal: {
      flexShrink: 1,
    },
    capsule: {
      flexShrink: 1,
      height: GLASS_BUTTON_SIZE,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 1,
      gap: TITLE_SHIELD_GAP,
      height: GLASS_BUTTON_SIZE,
      paddingHorizontal: TITLE_CAPSULE_PADDING,
    },
    shield: {
      color: theme.text.accent,
    },
    text: {
      flexShrink: 1,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
  });
