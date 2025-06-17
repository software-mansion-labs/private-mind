import React, { useEffect } from 'react';
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
  const rotation = useSharedValue(0);
  const { theme } = useTheme();

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
  const center = size / 2;
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  const text = `${minutes}:${String(seconds).padStart(2, '0')}`;
  const cx = size / 2;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
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
            cx={center}
            cy={center}
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
      <Text style={[styles.timeText, { color: theme.text.primary }]}>
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  spinner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeText: {
    position: 'absolute',
    fontFamily: fontFamily.medium,
    fontSize: fontSizes.xl,
  },
});
