import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Pressable,
  Keyboard,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DrawerProvider } from '../../context/DrawerContext';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import { Easing } from 'react-native-reanimated';

import DrawerMenu from './DrawerMenu';
import AppToast from '../AppToast';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;

const CustomDrawerLayout = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const openProgress = useState(new Animated.Value(0))[0];
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const openDrawer = () => {
    Keyboard.dismiss();
    setIsOpen(true);
    Animated.timing(openProgress, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(openProgress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start(() => {
      setIsOpen(false);
    });
  };

  return (
    <DrawerProvider openDrawer={openDrawer} closeDrawer={closeDrawer}>
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.content,
            {
              transform: [
                {
                  translateX: openProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, DRAWER_WIDTH],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        >
          {Platform.OS === 'android' && <StatusBar style="auto" />}
          {children}
        </Animated.View>

        {isOpen && (
          <Animated.View style={[styles.backdrop, { opacity: openProgress }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
          </Animated.View>
        )}

        <Animated.View
          style={[
            styles.drawer,
            {
              transform: [
                {
                  translateX: openProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-DRAWER_WIDTH, 0],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        >
          <DrawerMenu onNavigate={closeDrawer} />
        </Animated.View>
      </View>

      <AppToast />
    </DrawerProvider>
  );
};

export default CustomDrawerLayout;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
      paddingBottom: theme.insets.bottom === 0 ? 16 : 0,
    },
    content: {
      flex: 1,
    },
    drawer: {
      position: 'absolute',
      width: DRAWER_WIDTH,
      left: 0,
      top: 0,
      bottom: 0,
      zIndex: 3,
      elevation: 8,
      backgroundColor: theme.bg.softPrimary,
      paddingTop: theme.insets.top,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.bg.overlay,
      zIndex: 2,
    },
  });
