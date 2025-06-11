import React from 'react';
import { StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  onPress: () => void;
}

const FloatingActionButton = ({ onPress }: Props) => {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={{ ...styles.fab, backgroundColor: theme.bg.strongPrimary }}
      onPress={onPress}
    >
      <Text style={styles.fabText}>＋</Text>
    </TouchableOpacity>
  );
};

export default FloatingActionButton;

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: {
    color: '#fff',
    fontSize: 30,
  },
});
