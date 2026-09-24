import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import ChatIcon from '../assets/icons/chat.svg';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { Theme } from '../styles/colors';
import { startPhantomChat } from '../utils/startPhantomChat';
import { useChatStore } from '../store/chatStore';
import { useTurnInFlight } from '../hooks/useTurnInFlight';
import { showTurnInFlightNotice } from '../utils/turnInFlightNotice';

interface Props {
  noOp?: boolean;
}

const NewChatHeaderButton = ({ noOp = false }: Props) => {
  const db = useSQLiteContext();
  const { styles } = useThemedStyles(createStyles);

  const turnInFlight = useTurnInFlight();

  const handlePress = () => {
    if (turnInFlight) {
      showTurnInFlightNotice();
      return;
    }
    if (noOp) {
      useChatStore.getState().startBlankChat();
      return;
    }
    startPhantomChat(db, 'replace');
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.button}
      hitSlop={15}
      testID="new-chat-header-button"
    >
      <ChatIcon
        width={20}
        height={20}
        style={[styles.icon, turnInFlight && styles.iconDimmed]}
      />
    </TouchableOpacity>
  );
};

export default NewChatHeaderButton;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    button: {
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    icon: {
      color: theme.text.primary,
    },
    iconDimmed: {
      opacity: 0.4,
    },
  });
