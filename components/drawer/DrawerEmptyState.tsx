import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import ChatIcon from '../../assets/icons/chat.svg';
import SearchOffIcon from '../../assets/icons/search-off.svg';
import { radius, space, stroke } from '../../constants/design-system';
import { DrawerItem } from './DrawerItem';
import { useStartNewChat } from './useStartNewChat';

const ICON_CIRCLE_SIZE = 56;

interface Props {
  query: string;
  onNavigate?: () => void;
}

export const DrawerEmptyState = ({ query, onNavigate }: Props) => {
  const { styles } = useThemedStyles(createStyles);

  const { startNewChat, turnInFlight } = useStartNewChat(onNavigate);

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <SearchOffIcon width={24} height={24} style={styles.iconCircleIcon} />
      </View>
      <Text style={styles.title}>No chats match "{query}"</Text>
      <View style={styles.action}>
        <DrawerItem
          icon={<ChatIcon width={18} height={18} style={styles.icon} />}
          label="Start new chat"
          testID="drawer-empty-new-chat"
          active={false}
          dimmed={turnInFlight}
          hugContent
          onPress={startNewChat}
        />
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: space.six,
      paddingVertical: space.ten,
      alignItems: 'center',
      gap: space.four,
    },
    iconCircle: {
      width: ICON_CIRCLE_SIZE,
      height: ICON_CIRCLE_SIZE,
      borderRadius: radius.full,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.bg.tile,
    },
    iconCircleIcon: {
      color: theme.text.defaultSecondary,
    },
    title: {
      textAlign: 'center',
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.md,
      lineHeight: 22,
      color: theme.text.primary,
    },
    action: {
      alignSelf: 'center',
      overflow: 'hidden',
      borderRadius: radius.twelve,
      borderWidth: stroke.soft,
      borderColor: theme.border.soft,
    },
    icon: {
      color: theme.text.primary,
    },
  });
