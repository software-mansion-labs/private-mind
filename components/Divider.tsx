import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export const Divider = () => {
  const { theme } = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.border.soft }} />;
};
