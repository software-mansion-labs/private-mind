import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Theme } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';

interface TextInputBorderProps {
  active: boolean;
}

/**
 * Place inside a view wrapping a text input - it'll match dimensions of its parent.
 */
const TextInputBorder: React.FC<TextInputBorderProps> = ({ active }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.common, active ? styles.active : styles.inactive]} />
  );
};

export default TextInputBorder;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    common: {
      borderRadius: 12,
      pointerEvents: 'none',
      ...StyleSheet.absoluteFillObject,
    },
    inactive: {
      borderWidth: 1,
      borderColor: theme.border.soft,
    },
    active: {
      borderWidth: 2,
      borderColor: theme.bg.strongPrimary,
    },
  });
