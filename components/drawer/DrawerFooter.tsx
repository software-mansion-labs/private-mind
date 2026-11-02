import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { useRouter, usePathname } from 'expo-router';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useLLMStore } from '../../store/llmStore';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import ChatIcon from '../../assets/icons/chat.svg';
import SettingsIcon from '../../assets/icons/settings.svg';
import {
  DRAWER_HORIZONTAL_PADDING,
  DRAWER_ITEM_INSET,
} from '../../constants/drawer-layout';
import { radius } from '../../constants/design-system';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import { useStartNewChat } from './useStartNewChat';
import { dimmedOpacity, pressedOpacity } from '../../styles/pressable';

const FOOTER_BUTTON_HEIGHT = 44;

interface Props {
  onNavigate?: () => void;
}

export const DrawerFooter = ({ onNavigate }: Props) => {
  const { styles } = useThemedStyles(createStyles);

  const router = useRouter();
  const pathname = usePathname();
  const interrupt = useLLMStore((state) => state.interrupt);

  const { startNewChat, turnInFlight } = useStartNewChat(onNavigate);

  const goToSettings = () => {
    interrupt();
    router.replace('/settings');
    onNavigate?.();
  };

  return (
    <View style={styles.footer}>
      <Pressable
        onPress={startNewChat}
        testID="drawer-new-chat"
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.newChat,
          pressed && pressedOpacity,
          turnInFlight && dimmedOpacity,
        ]}
      >
        <ChatIcon width={18} height={18} style={styles.newChatIcon} />
        <Text
          style={styles.newChatLabel}
          numberOfLines={1}
          maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
        >
          New chat
        </Text>
      </Pressable>

      <Pressable
        onPress={goToSettings}
        testID="drawer-settings"
        accessibilityRole="button"
        accessibilityLabel="Settings"
        style={({ pressed }) => [
          styles.settings,
          (pressed || pathname === '/settings') && styles.settingsActive,
        ]}
      >
        <SettingsIcon width={20} height={20} style={styles.settingsIcon} />
      </Pressable>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingTop: 12,
      paddingBottom: Math.max(theme.insets.bottom, 12),
      paddingLeft: DRAWER_HORIZONTAL_PADDING + DRAWER_ITEM_INSET,
      paddingRight: DRAWER_HORIZONTAL_PADDING,
    },
    newChat: {
      flexShrink: 1,
      minHeight: FOOTER_BUTTON_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingLeft: 14,
      paddingRight: 18,
      borderRadius: radius.full,
      backgroundColor: theme.bg.main,
    },
    newChatIcon: {
      color: theme.text.onBrand,
    },
    newChatLabel: {
      flexShrink: 1,
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      color: theme.text.onBrand,
    },
    settings: {
      width: FOOTER_BUTTON_HEIGHT,
      height: FOOTER_BUTTON_HEIGHT,
      borderRadius: radius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    settingsActive: {
      backgroundColor: theme.bg.softTertiary,
    },
    settingsIcon: {
      color: theme.text.primary,
    },
  });
