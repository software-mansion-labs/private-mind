import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import ChatIcon from '../assets/icons/chat.svg';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { Theme } from '../styles/colors';
import { startPhantomChat } from '../utils/startPhantomChat';

interface Props {
  noOp?: boolean;
}

const NewChatHeaderButton = ({ noOp = false }: Props) => {
  const db = useSQLiteContext();
  const { styles } = useThemedStyles(createStyles);

  const handlePress = () => {
    if (noOp) return;
    startPhantomChat(db, 'replace');
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.button} hitSlop={15}>
      <ChatIcon width={20} height={20} style={styles.icon} />
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
  });
