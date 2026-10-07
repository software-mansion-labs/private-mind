import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import * as Application from 'expo-application';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { Theme } from '../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../styles/fontStyles';
import { radius } from '../constants/design-system';
import { LATEST_RELEASE } from '../constants/latest-release';
import { useSettingsStore } from '../store/settingsStore';
import { Feedback } from '../utils/Feedback';
import CloseIcon from '../assets/icons/cross-small.svg';

const installedVersion =
  Application.nativeApplicationVersion ?? LATEST_RELEASE.version;

const WhatsNewCard = () => {
  const { styles } = useThemedStyles(createStyles);
  const dismissedVersion = useSettingsStore(
    (state) => state.dismissedWhatsNewVersion
  );
  const dismissWhatsNew = useSettingsStore((state) => state.dismissWhatsNew);
  const hasHydrated = useSettingsStore((state) => state.hasHydrated);

  if (!hasHydrated || dismissedVersion === installedVersion) return null;

  const handleDismiss = () => {
    Feedback.toggleOff();
    dismissWhatsNew(installedVersion);
  };

  return (
    <Animated.View
      style={styles.card}
      exiting={FadeOut.duration(160)}
      layout={LinearTransition}
      testID="whats-new-card"
    >
      <View style={styles.header}>
        <Text style={styles.badge}>What's new</Text>
        <View style={styles.headerTrailing}>
          <Text style={styles.version}>v{installedVersion}</Text>
          <Pressable
            onPress={handleDismiss}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Dismiss what's new"
            testID="whats-new-dismiss"
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
          >
            <CloseIcon width={16} height={16} style={styles.closeIcon} />
          </Pressable>
        </View>
      </View>
      <Text style={styles.title}>{LATEST_RELEASE.title}</Text>
      <View style={styles.list}>
        {LATEST_RELEASE.highlights.map((item, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.item}>{item}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
};

export default WhatsNewCard;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      width: '100%',
      backgroundColor: theme.bg.softSecondary,
      borderRadius: radius.eighteen,
      padding: 16,
      gap: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTrailing: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    closeButton: {
      width: 24,
      height: 24,
      borderRadius: radius.twelve,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeButtonPressed: {
      backgroundColor: theme.bg.softSecondary,
    },
    closeIcon: {
      color: theme.text.defaultSecondary,
    },
    badge: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      color: theme.bg.main,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    version: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      color: theme.text.defaultTertiary,
    },
    title: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.lg,
      lineHeight: lineHeights.lg,
      color: theme.text.primary,
    },
    list: {
      gap: 6,
    },
    row: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
    },
    bullet: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.bg.main,
    },
    item: {
      flex: 1,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.defaultSecondary,
    },
  });
