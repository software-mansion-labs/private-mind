import React, { useLayoutEffect } from 'react';
import { useNavigation } from 'expo-router';
import DrawerToggleButton from '../components/drawer/DrawerToggleButton';

export default function useDefaultHeader() {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShadowVisible: false,
      headerLeft: () => <DrawerToggleButton />,
    });
  }, [navigation]);
}
