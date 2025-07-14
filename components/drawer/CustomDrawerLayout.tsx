import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Pressable,
  StatusBar,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DrawerProvider } from '../../context/DrawerContext';
import { useTheme } from '../../context/ThemeContext';
import { fontSizes, fontFamily } from '../../styles/fontFamily';
import { Theme } from '../../styles/colors';
import { Easing } from 'react-native-reanimated/src/Easing';
import Toast from 'react-native-toast-message';

import DrawerMenu from './DrawerMenu';
import CloseIcon from '../../assets/icons/close.svg';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;

const CustomDrawerLayout = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const translateX = useState(new Animated.Value(-DRAWER_WIDTH))[0];
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const openDrawer = () => {
    Keyboard.dismiss();
    setIsOpen(true);
    Animated.timing(translateX, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(translateX, {
      toValue: -DRAWER_WIDTH,
      duration: 200,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start(() => {
      setIsOpen(false);
    });
  };

  const toastConfig = {
    defaultToast: ({ text1 }: any) => (
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
                  translateX: translateX.interpolate({
                    inputRange: [-DRAWER_WIDTH, 0],
                    outputRange: [0, DRAWER_WIDTH],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        >
          <SafeAreaView style={styles.safeArea}>
            <StatusBar backgroundColor={theme.bg.softPrimary} />
            {children}
          </SafeAreaView>
        </Animated.View>

        {isOpen && <Pressable style={styles.backdrop} onPress={closeDrawer} />}

        <Animated.View
          style={[
            styles.drawer,
            {
              transform: [{ translateX }],
              paddingTop: insets.top,
            },
          ]}
        >
          <DrawerMenu onNavigate={closeDrawer} />
        </Animated.View>
      </View>

      <Toast config={toastConfig} />
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
    safeArea: {
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
