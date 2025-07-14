import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  withRepeat,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { fontFamily, fontSizes } from '../styles/fontFamily';
import { Theme } from '../styles/colors';

interface SpinningCircleProps {
  size?: number;
  strokeWidth?: number;
  time: number;
}

export const SpinningCircleTimer = ({
  size = 100,
  strokeWidth = 8,
  time,
}: SpinningCircleProps) => {
  const { theme } = useTheme();
  const rotation = useSharedValue(0);
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 1000,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;

  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  const displayTime = `${minutes}:${String(seconds).padStart(2, '0')}`;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cx}
          r={radius}
          stroke={theme.text.defaultTertiary}
          strokeWidth={strokeWidth}
          fill="none"
        />
      </Svg>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.spinner, animatedStyle]}
      >
        <Svg height={size} width={size}>
          <Circle
            cx={cx}
            cy={cx}
            r={radius}
            stroke={theme.text.primary}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${Math.PI * 2 * radius * 0.75}, ${
              Math.PI * 2 * radius
            }`}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
      <Text style={styles.timeText}>{displayTime}</Text>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    spinner: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    timeText: {
      position: 'absolute',
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xl,
      color: theme.text.primary,
    },
  });
