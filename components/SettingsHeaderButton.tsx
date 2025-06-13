import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Settings from '../assets/icons/settings.svg';
import { useTheme } from '../context/ThemeContext';

interface Props {
  chatId: number | null;
}

const SettingsHeaderButton = ({ chatId }: Props) => {
  const router = useRouter();
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => router.push(`/chat/${chatId}/settings`)}
      style={styles.button}
    >
      <Settings width={18} height={20} style={{ color: theme.text.primary }} />
    </TouchableOpacity>
  );
};

export default SettingsHeaderButton;

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 20,
  },
});
