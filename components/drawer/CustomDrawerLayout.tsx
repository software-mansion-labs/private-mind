import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Pressable,
  Text,
  TouchableOpacity,
  Keyboard,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { DrawerProvider } from '../../context/DrawerContext';
import { useTheme } from '../../context/ThemeContext';
import { fontSizes, fontFamily } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { Easing } from 'react-native-reanimated/src/Easing';
import Toast, { ToastConfig } from 'react-native-toast-message';

import DrawerMenu from './DrawerMenu';
import CloseIcon from '../../assets/icons/close.svg';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;

const CustomDrawerLayout = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const openProgress = useState(new Animated.Value(0))[0];
  const insets = useSafeAreaInsets();
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

  const toastConfig: ToastConfig = {
    defaultToast: ({ text1 }) => (
      <View style={styles.toastContainer}>
        <Text style={styles.toastText}>{text1}</Text>
        <TouchableOpacity
          onPress={() => Toast.hide()}
          style={styles.toastCloseButton}
        >
          <CloseIcon width={13.33} height={13.33} style={styles.toastIcon} />
        </TouchableOpacity>
      </View>
    ),
  };

  return (
    <DrawerProvider openDrawer={openDrawer} closeDrawer={closeDrawer}>
      <View
        style={[
          styles.container,
          { paddingBottom: insets.bottom === 0 ? 16 : 0 },
        ]}
      >
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
              paddingTop: insets.top,
            },
          ]}
        >
          <DrawerMenu onNavigate={closeDrawer} />
        </Animated.View>
      </View>

      <Toast config={toastConfig} topOffset={insets.top + 16} />
    </DrawerProvider>
  );
};

export default CustomDrawerLayout;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
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
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.bg.overlay,
      zIndex: 2,
    },
    toastContainer: {
      width: '90%',
      backgroundColor: theme.bg.softSecondary,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
    },
    toastText: {
      color: theme.text.primary,
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.sm,
      width: '80%',
    },
    toastCloseButton: {
      width: '20%',
      alignItems: 'flex-end',
      marginTop: 3.33,
    },
    toastIcon: {
      color: theme.text.primary,
    },
  });
