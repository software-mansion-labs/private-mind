import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import DrawerMenu from './DrawerMenu';
import {
  DrawerContentComponentProps,
  useDrawerStatus,
} from '@react-navigation/drawer';
import { Feedback } from '../../utils/Feedback';

const CustomDrawer = (props: DrawerContentComponentProps) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const status = useDrawerStatus();

  useEffect(() => {
    Feedback.light();
  }, [status]);

  return (
    <View style={styles.container}>
      <DrawerMenu />
    </View>
  );
};

export default CustomDrawer;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
      paddingTop: 32,
    },
  });
