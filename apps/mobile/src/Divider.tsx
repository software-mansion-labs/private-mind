import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Theme } from '../styles/colors';

export const Divider = () => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return <View style={styles.divider} />;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    divider: {
      height: 1,
      backgroundColor: theme.border.soft,
    },
  });
