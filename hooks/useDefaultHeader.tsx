import React, { useLayoutEffect } from 'react';
import { useNavigation } from 'expo-router';
import DrawerToggleButton from '../components/drawer/DrawerToggleButton';

interface Options {
  glass?: boolean;
}

export default function useDefaultHeader({ glass = false }: Options = {}) {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShadowVisible: false,
      headerLeft: () => <DrawerToggleButton glass={glass} />,
    });
  }, [navigation, glass]);
}
