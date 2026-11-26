import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import ChatIcon from '../../assets/icons/chat.svg';
import SettingsIcon from '../../assets/icons/settings.svg';
import {
  DRAWER_FOOTER_BUTTON_HEIGHT,
  DRAWER_FOOTER_EDGE_GAP,
  DRAWER_FOOTER_TOP_PADDING,
  DRAWER_ITEM_INSET,
  getDrawerFooterBottomPadding,
} from '../../constants/drawer-layout';
import { radius, space } from '../../constants/design-system';
import { useStartNewChat } from './useStartNewChat';
import { dimmedOpacity, pressedOpacity } from '../../styles/pressable';
import HeaderGlassButton, { headerGlassButtonFill } from '../HeaderGlassButton';
import CollapsibleLabel from '../CollapsibleLabel';

const NEW_CHAT_ICON_SIZE = 18;
const NEW_CHAT_PADDING_LEFT = 14;
const NEW_CHAT_PADDING_RIGHT = 18;
const NEW_CHAT_COLLAPSED_PADDING =
  (DRAWER_FOOTER_BUTTON_HEIGHT - NEW_CHAT_ICON_SIZE) / 2;
const NEW_CHAT_LABEL_GAP = space.two;
const ESTIMATED_LABEL_WIDTH = 71;

interface Props {
  onNavigate?: () => void;
  newChatCollapse?: SharedValue<number>;
}

export const DrawerFooter = ({ onNavigate, newChatCollapse }: Props) => {
  const { styles } = useThemedStyles(createStyles);

  const fallbackCollapse = useSharedValue(0);
  const collapse = newChatCollapse ?? fallbackCollapse;

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

  const router = useRouter();

  const { startNewChat, turnInFlight } = useStartNewChat(onNavigate);

  const openSettings = () => router.push('/settings');

  return (
    <View style={styles.footer}>
      <HeaderGlassButton edge="leading">
        <Pressable
          onPress={openSettings}
          testID="drawer-settings"
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={15}
          style={({ pressed }) => [
            headerGlassButtonFill,
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
          <CollapsibleLabel
            text="New chat"
            collapse={collapse}
            gap={NEW_CHAT_LABEL_GAP}
            estimatedWidth={ESTIMATED_LABEL_WIDTH}
            textStyle={styles.newChatLabel}
          />
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
      paddingTop: DRAWER_FOOTER_TOP_PADDING,
      paddingBottom: getDrawerFooterBottomPadding(theme.insets.bottom),
      paddingLeft: DRAWER_ITEM_INSET,
      paddingRight: DRAWER_FOOTER_EDGE_GAP,
    },
    newChat: {
      height: DRAWER_FOOTER_BUTTON_HEIGHT,
      borderRadius: radius.full,
      backgroundColor: theme.bg.main,
    },
    newChatContent: {
      flex: 1,
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
    settingsIcon: {
      color: theme.text.primary,
    },
  });
