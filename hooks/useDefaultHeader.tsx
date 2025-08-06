import React from 'react';
import { useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import DrawerToggleButton from '../components/drawer/DrawerToggleButton';
import { useTheme } from '../context/ThemeContext';

export default function useDefaultHeader() {
  const navigation = useNavigation();
  const { theme } = useTheme();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShadowVisible: false,
      headerLeft: () => <DrawerToggleButton />,
    });
  }, [navigation, theme]);
}
