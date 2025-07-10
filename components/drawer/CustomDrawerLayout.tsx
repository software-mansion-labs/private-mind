import React, { useState } from 'react';
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
import DrawerMenu from './DrawerMenu';
import { DrawerProvider } from '../../context/DrawerContext';
import { Easing } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import CloseIcon from '../../assets/icons/close.svg';
import Toast from 'react-native-toast-message';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;

const CustomDrawerLayout = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const translateX = useState(new Animated.Value(-DRAWER_WIDTH))[0];
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
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
      <View
        style={{
          width: '90%',
          backgroundColor: theme.bg.softSecondary,
          borderRadius: 12,
          padding: 16,
          flexDirection: 'row',
        }}
      >
        <Text
          style={{
            color: theme.text.primary,
            fontFamily: fontFamily.bold,
            fontSize: fontSizes.sm,
            width: '80%',
          }}
        >
          {text1}
        </Text>
        <TouchableOpacity
          onPress={() => Toast.hide()}
          style={{ width: '20%', alignItems: 'flex-end', marginTop: 3.33 }}
        >
          <CloseIcon
            width={13.33}
            height={13.33}
            style={{ color: theme.text.primary }}
          />
        </TouchableOpacity>
      </View>
    ),
  };

  return (
    <DrawerProvider openDrawer={openDrawer} closeDrawer={closeDrawer}>
      <View
        style={{
          ...styles.container,
          backgroundColor: theme.bg.softPrimary,
          paddingBottom: insets.bottom === 0 ? 16 : 0,
        }}
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
          <SafeAreaView
            style={{
              flex: 1,
              backgroundColor: theme.bg.softPrimary,
            }}
          >
            <StatusBar backgroundColor={theme.bg.softPrimary} />
            {children}
          </SafeAreaView>
        </Animated.View>

        {isOpen && (
          <Pressable
            style={{ ...styles.backdrop, backgroundColor: theme.bg.overlay }}
            onPress={closeDrawer}
          />
        )}

        <Animated.View
          style={[
            styles.drawer,
            {
              transform: [{ translateX }],
              paddingTop: insets.top,
              backgroundColor: theme.bg.softPrimary,
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    zIndex: 2,
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
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
});
