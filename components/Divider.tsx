import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { Theme } from '../styles/colors';

export const Divider = () => {
  const { styles } = useThemedStyles(createStyles);

  return <View style={styles.divider} />;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    divider: {
      height: 1,
      backgroundColor: theme.border.soft,
    },
  });
