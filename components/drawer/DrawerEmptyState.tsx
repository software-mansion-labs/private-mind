import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useTheme } from '../../context/ThemeContext';
import { useChatStore } from '../../store/chatStore';
import { useLLMStore } from '../../store/llmStore';
import { startPhantomChat } from '../../utils/startPhantomChat';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import ChatIcon from '../../assets/icons/chat.svg';
import { DrawerItem } from './DrawerItem';

interface Props {
  onNavigate?: () => void;
}

export const DrawerEmptyState = ({ onNavigate }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const pathname = usePathname();
  const db = useSQLiteContext();
  const { phantomChat } = useChatStore();
  const { interrupt } = useLLMStore();

  const isOnPhantomChat =
    phantomChat != null && pathname === `/chat/${phantomChat.id}`;

  const startNewChat = () => {
    if (isOnPhantomChat) {
      onNavigate?.();
      return;
    }
    interrupt();
    startPhantomChat(db, 'replace');
    onNavigate?.();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>No chats found</Text>
      <View style={styles.action}>
        <DrawerItem
          icon={<ChatIcon width={18} height={18} style={styles.icon} />}
          label="Start new chat"
          testID="drawer-empty-new-chat"
          active={false}
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
      paddingHorizontal: 12,
      paddingVertical: 32,
      alignItems: 'center',
      gap: 16,
    },
    text: {
      textAlign: 'center',
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.defaultTertiary,
    },
    action: {
      alignSelf: 'center',
      overflow: 'hidden',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border.soft,
    },
    icon: {
      color: theme.text.primary,
    },
  });
