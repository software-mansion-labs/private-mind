import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import PlusIcon from '../../assets/icons/plus.svg';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';

interface Props {
  onPress: () => void;
}

const FloatingActionButton = ({ onPress }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <PlusIcon width={18} height={18} style={styles.icon} />
    </TouchableOpacity>
  );
};

export default FloatingActionButton;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    button: {
      position: 'absolute',
      right: 20,
      bottom: 30,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg.main,
    },
    icon: {
      color: theme.text.contrastPrimary,
    },
  });
