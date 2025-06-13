import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DrawerMenu from './DrawerMenu';
import { DrawerProvider } from '../../context/DrawerContext';
import { Easing } from 'react-native-reanimated';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;

const CustomDrawerLayout = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const translateX = useState(new Animated.Value(-DRAWER_WIDTH))[0];
  const insets = useSafeAreaInsets();

  const openDrawer = () => {
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

  return (
    <DrawerProvider openDrawer={openDrawer} closeDrawer={closeDrawer}>
      <View style={styles.container}>
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
          {children}
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
    backgroundColor: '#fff',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    zIndex: 2,
  },
  menuButton: {
    padding: 8,
  },
  menuIcon: {
    fontSize: 24,
    color: '#333',
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
  },
  drawer: {
    position: 'absolute',
    width: DRAWER_WIDTH,
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#fff',
    zIndex: 3,
    elevation: 8,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    zIndex: 2,
  },
});
