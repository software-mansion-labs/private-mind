import React, { useMemo } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Settings from '../assets/icons/settings.svg';
import { useTheme } from '../context/ThemeContext';
import { Theme } from '../styles/colors';

interface Props {
  chatId: number | null;
}

const SettingsHeaderButton = ({ chatId }: Props) => {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handlePress = () => {
    router.push(`/chat/${chatId}/settings`);
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.button}>
      <Settings width={18} height={20} style={styles.icon} />
    </TouchableOpacity>
  );
};

export default SettingsHeaderButton;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    button: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    icon: {
      color: theme.text.primary,
    },
  });
