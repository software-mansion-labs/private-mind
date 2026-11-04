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
import { radius, space } from '../../constants/design-system';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import { useStartNewChat } from './useStartNewChat';
import { dimmedOpacity, pressedOpacity } from '../../styles/pressable';
import HeaderGlassButton, { headerGlassButtonFill } from '../HeaderGlassButton';

const FOOTER_BUTTON_HEIGHT = 44;
const FOOTER_EDGE_GAP = DRAWER_HORIZONTAL_PADDING + DRAWER_ITEM_INSET;

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
      <HeaderGlassButton edge="leading">
        <Pressable
          onPress={goToSettings}
          testID="drawer-settings"
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={15}
          style={({ pressed }) => [
            headerGlassButtonFill,
            pathname === '/settings' && styles.settingsActive,
            pressed && pressedOpacity,
          ]}
        >
          <SettingsIcon width={20} height={20} style={styles.settingsIcon} />
        </Pressable>
      </HeaderGlassButton>

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
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.three,
      paddingTop: space.three,
      paddingBottom: Math.max(theme.insets.bottom, FOOTER_EDGE_GAP),
      paddingLeft: DRAWER_ITEM_INSET,
      paddingRight: FOOTER_EDGE_GAP,
    },
    newChat: {
      flexShrink: 1,
      minHeight: FOOTER_BUTTON_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.two,
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
    settingsActive: {
      backgroundColor: theme.bg.softTertiary,
    },
    settingsIcon: {
      color: theme.text.primary,
    },
  });
