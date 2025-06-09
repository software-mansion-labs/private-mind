import React, { useEffect } from 'react';
import { useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import DrawerToggleButton from '../components/drawer/DrawerToggleButton';
import { Platform, BackHandler } from 'react-native';
import { useDrawer } from '../context/DrawerContext';

export const useDefaultHeader = () => {
  const navigation = useNavigation();
  const { openDrawer } = useDrawer();

  useEffect(() => {
    const backAction = () => {
      if (Platform.OS === 'android') {
        openDrawer();
        return true;
      }
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => subscription.remove();
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => <DrawerToggleButton />,
    });
  }, [navigation]);
};
