import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  withRepeat,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';

interface SpinningCircleProps {
  size?: number;
  strokeWidth?: number;
}

const SpinningCircle = ({ size = 20, strokeWidth = 2 }: SpinningCircleProps) => {
  const { theme } = useTheme();
  const rotation = useSharedValue(0);

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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
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
        style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }, animatedStyle]}
      >
        <Svg height={size} width={size}>
          <Circle
            cx={cx}
            cy={cx}
            r={radius}
            stroke={theme.text.primary}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${Math.PI * 2 * radius * 0.25}, ${Math.PI * 2 * radius}`}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
    </View>
  );
};

export default SpinningCircle;