import React from 'react';
import { useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import DrawerToggleButton from '../components/drawer/DrawerToggleButton';
import { useTheme } from '../context/ThemeContext';
import { fontFamily, fontSizes } from '../styles/fontStyles';

export default function useDefaultHeader() {
  const navigation = useNavigation();
  const { theme } = useTheme();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => <DrawerToggleButton />,
      headerStyle: {
        backgroundColor: theme.bg.softPrimary,
      },
      headerTitleStyle: {
        color: theme.text.primary,
        fontFamily: fontFamily.medium,
        fontSizes: fontSizes.md,
      },
    });
  }, [navigation, theme]);
}
