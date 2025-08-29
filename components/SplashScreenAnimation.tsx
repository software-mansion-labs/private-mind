import React, { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { lightTheme, Theme } from '../styles/colors';
import { SplashScreen } from 'expo-router';
import Animated, {
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

function SplashScreenAnimation() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const rippleProgress = useSharedValue(0);
  const [done, setDone] = React.useState(false);

  useEffect(() => {
    const startAnimation = async () => {
      SplashScreen.hide();
      rippleProgress.value = withTiming(1, { duration: 800 }, () => {
        runOnJS(setDone)(true);
      });
    };

    startAnimation();
  }, []);

  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rippleProgress.value }],
  }));

  if (done) {
    return null;
  }

  return (
    <Animated.View
      needsOffscreenAlphaCompositing
      style={styles.wrapper}
      exiting={FadeOut}
    >
      <Animated.Image
        source={require('../assets/icons/splash_icon.png')}
        style={styles.logo}
      />
      <Animated.View style={[styles.ripple, rippleStyle]} />
    </Animated.View>
  );
}

export default SplashScreenAnimation;

const splashColor = lightTheme.bg.main;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');
const DIAMETER = Math.sqrt(SCREEN_WIDTH ** 2 + SCREEN_HEIGHT ** 2);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: splashColor,
    },
    ripple: {
      width: DIAMETER,
      height: DIAMETER,
      borderRadius: DIAMETER / 2,
      position: 'absolute',
      top: (SCREEN_HEIGHT - DIAMETER) / 2,
      left: (SCREEN_WIDTH - DIAMETER) / 2,
      backgroundColor: theme.text.contrastPrimary,
    },
    logo: {
      width: 140,
      height: 140,
    },
  });
