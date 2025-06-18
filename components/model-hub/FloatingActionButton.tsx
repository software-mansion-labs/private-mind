import React from 'react';
import { StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import PlusIcon from '../../assets/icons/plus.svg';

interface Props {
  onPress: () => void;
}

const FloatingActionButton = ({ onPress }: Props) => {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={{ ...styles.fab, backgroundColor: theme.bg.main }}
      onPress={onPress}
    >
      <PlusIcon
        width={18}
        height={18}
        style={{ color: theme.text.contrastPrimary }}
      />
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
});
