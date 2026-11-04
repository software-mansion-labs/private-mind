import React from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
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
const NEW_CHAT_ICON_SIZE = 18;
const NEW_CHAT_PADDING_LEFT = 14;
const NEW_CHAT_PADDING_RIGHT = 18;
const NEW_CHAT_COLLAPSED_PADDING =
  (FOOTER_BUTTON_HEIGHT - NEW_CHAT_ICON_SIZE) / 2;
const NEW_CHAT_LABEL_GAP = space.two;
const ESTIMATED_LABEL_WIDTH = 71;
const LABEL_MEASURING_ROOM = 400;

interface Props {
  onNavigate?: () => void;
  newChatCollapse?: SharedValue<number>;
}

export const DrawerFooter = ({ onNavigate, newChatCollapse }: Props) => {
  const { styles } = useThemedStyles(createStyles);

  const fallbackCollapse = useSharedValue(0);
  const collapse = newChatCollapse ?? fallbackCollapse;
  const labelWidth = useSharedValue(ESTIMATED_LABEL_WIDTH);

  const handleLabelLayout = (event: LayoutChangeEvent) =>
    labelWidth.set(event.nativeEvent.layout.width);

  const newChatContentStyle = useAnimatedStyle(() => ({
    paddingLeft: interpolate(
      collapse.get(),
      [0, 1],
      [NEW_CHAT_PADDING_LEFT, NEW_CHAT_COLLAPSED_PADDING]
    ),
    paddingRight: interpolate(
      collapse.get(),
      [0, 1],
      [NEW_CHAT_PADDING_RIGHT, NEW_CHAT_COLLAPSED_PADDING]
    ),
  }));

  const labelSlotStyle = useAnimatedStyle(() => ({
    width: interpolate(collapse.get(), [0, 1], [labelWidth.get(), 0]),
    marginLeft: interpolate(collapse.get(), [0, 1], [NEW_CHAT_LABEL_GAP, 0]),
    opacity: interpolate(collapse.get(), [0, 0.6], [1, 0], 'clamp'),
  }));

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
        accessibilityLabel="New chat"
        style={({ pressed }) => [
          styles.newChat,
          pressed && pressedOpacity,
          turnInFlight && dimmedOpacity,
        ]}
      >
        <Animated.View style={[styles.newChatContent, newChatContentStyle]}>
          <ChatIcon
            width={NEW_CHAT_ICON_SIZE}
            height={NEW_CHAT_ICON_SIZE}
            style={styles.newChatIcon}
          />
          <Animated.View style={[styles.labelSlot, labelSlotStyle]}>
            <View style={styles.labelRoom}>
              <Text
                style={styles.newChatLabel}
                numberOfLines={1}
                maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
                onLayout={handleLabelLayout}
              >
                New chat
              </Text>
            </View>
          </Animated.View>
        </Animated.View>
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
      height: FOOTER_BUTTON_HEIGHT,
      borderRadius: radius.full,
      backgroundColor: theme.bg.main,
    },
    newChatContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    labelSlot: {
      alignSelf: 'stretch',
      overflow: 'hidden',
    },
    labelRoom: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: LABEL_MEASURING_ROOM,
      flexDirection: 'row',
      alignItems: 'center',
    },
    newChatIcon: {
      color: theme.text.onBrand,
    },
    newChatLabel: {
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
