import React, { useCallback, useEffect, useRef } from 'react';
import { Keyboard, Pressable, StyleSheet, Text } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { Theme } from '../styles/colors';
import { fontFamily } from '../styles/fontStyles';
import { space } from '../constants/design-system';
import { CAPPED_TEXT_MAX_SCALE } from '../constants/font-scale';
import { LATEST_RELEASE, type Release } from '../constants/latest-release';
import { useSettingsStore } from '../store/settingsStore';
import { currentAppVersion } from '../utils/appVersion';
import { isOnboardingComplete } from '../utils/onboardingStatus';
import { Feedback } from '../utils/Feedback';
import { pressedOpacity } from '../styles/pressable';
import WhatsNewSheet from './bottomSheets/WhatsNewSheet';
import { Glass } from './chat-screen/attachments/Glass';
import ChevronRightIcon from '../assets/icons/chevron-right.svg';

const BADGE_HEIGHT = 32;
const BADGE_HIT_SLOP = 6;
const BADGE_TEXT_SIZE = 13;
const BADGE_LINE_HEIGHT = 18;
const CHEVRON_WIDTH = 6;
const CHEVRON_HEIGHT = 10;

export const shouldOpenOnLaunch = (
  release: Release,
  installedVersion: string,
  seenVersion: string | null
): boolean =>
  release.opensOnLaunch &&
  release.version === installedVersion &&
  seenVersion !== installedVersion;

interface Props {
  onSheetOpenChange?: (open: boolean) => void;
}

const WhatsNewBadge = ({ onSheetOpenChange }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const sheetRef = useRef<BottomSheetModal>(null);
  const seenVersion = useSettingsStore(
    (state) => state.dismissedWhatsNewVersion
  );
  const markSeen = useSettingsStore((state) => state.dismissWhatsNew);
  const hasHydrated = useSettingsStore((state) => state.hasHydrated);
  const installedVersion = currentAppVersion();

  const openSheet = useCallback(() => {
    Keyboard.dismiss();
    sheetRef.current?.present();
    markSeen(installedVersion);
  }, [installedVersion, markSeen]);

  useEffect(() => {
    if (
      !hasHydrated ||
      !shouldOpenOnLaunch(LATEST_RELEASE, installedVersion, seenVersion)
    ) {
      return;
    }
    let cancelled = false;
    isOnboardingComplete()
      .then((complete) => {
        if (complete && !cancelled) openSheet();
      })
      .catch((error) => {
        console.error('Failed to check onboarding for What is new:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [hasHydrated, installedVersion, openSheet, seenVersion]);

  return (
    <>
      {hasHydrated && seenVersion !== installedVersion && (
        <Glass
          radius={BADGE_HEIGHT / 2}
          fallbackTint={theme.bg.chatBar}
          style={styles.glass}
        >
          <Pressable
            style={({ pressed }) => [styles.badge, pressed && pressedOpacity]}
            onPress={() => {
              Feedback.sheetOpen();
              openSheet();
            }}
            hitSlop={BADGE_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={`What's new in version ${installedVersion}: ${LATEST_RELEASE.title}`}
            testID="whats-new-badge"
          >
            <Text
              style={styles.label}
              maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
            >
              New
            </Text>
            <Text
              style={styles.title}
              numberOfLines={1}
              maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
            >
              {LATEST_RELEASE.title}
            </Text>
            <ChevronRightIcon
              width={CHEVRON_WIDTH}
              height={CHEVRON_HEIGHT}
              style={styles.chevron}
            />
          </Pressable>
        </Glass>
      )}
      <WhatsNewSheet
        ref={sheetRef}
        version={installedVersion}
        onOpenChange={onSheetOpenChange}
      />
    </>
  );
};

export default WhatsNewBadge;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
      minHeight: BADGE_HEIGHT,
      gap: space.two,
      paddingHorizontal: space.three,
    },
    glass: {
      flexShrink: 1,
    },
    label: {
      fontFamily: fontFamily.bold,
      fontSize: BADGE_TEXT_SIZE,
      lineHeight: BADGE_LINE_HEIGHT,
      color: theme.text.accent,
    },
    title: {
      flexShrink: 1,
      fontFamily: fontFamily.regular,
      fontSize: BADGE_TEXT_SIZE,
      lineHeight: BADGE_LINE_HEIGHT,
      color: theme.text.primary,
    },
    chevron: {
      color: theme.text.primary,
    },
  });
