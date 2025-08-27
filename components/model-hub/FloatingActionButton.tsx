import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import PlusIcon from '../../assets/icons/plus.svg';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';

interface Props {
  onPress: () => void;
  disabled?: boolean;
}

const FloatingActionButton = ({ onPress, disabled = false }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme, disabled), [theme, disabled]);

  return (
    <TouchableOpacity 
      style={styles.button} 
      onPress={onPress}
      disabled={disabled}
    >
      <PlusIcon width={18} height={18} style={styles.icon} />
    </TouchableOpacity>
  );
};

export default FloatingActionButton;

const createStyles = (theme: Theme, disabled: boolean) =>
  StyleSheet.create({
    button: {
      position: 'absolute',
      right: 20,
      bottom: 16 + theme.insets.bottom,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: disabled ? theme.text.defaultTertiary : theme.bg.main,
    },
    icon: {
      color: disabled ? theme.text.defaultSecondary : theme.text.contrastPrimary,
    },
  });
