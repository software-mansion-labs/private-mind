import React, { useMemo } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import ChatIcon from '../assets/icons/chat.svg';
import { useTheme } from '../context/ThemeContext';
import { Theme } from '../styles/colors';

const NewChatHeaderButton = () => {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handlePress = () => {
    router.push('/');
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
