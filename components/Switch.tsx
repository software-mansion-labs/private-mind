import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';

interface Props {
  value: SharedValue<boolean>;
  onPress: () => void;
  duration?: number;
  style?: ViewStyle;
}

const Switch = ({ value, onPress, duration = 400, style }: Props) => {
  const { theme } = useTheme();
  const height = useSharedValue(0);
  const width = useSharedValue(0);
  const trackColors = {
    on: theme.bg.main,
    off: theme.bg.softPrimary,
  };
  const trackAnimatedStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      Number(value.value),
      [0, 1],
      [trackColors.off, trackColors.on]
    );

    const borderColor = interpolateColor(
      Number(value.value),
      [0, 1],
      [theme.bg.strongPrimary, theme.bg.main]
    );

    return {
      backgroundColor: withTiming(backgroundColor, { duration }),
      borderRadius: height.value / 2,
      borderColor: withTiming(borderColor, { duration }),
    };
  });

  const thumbAnimatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      Number(value.value),
      [0, 1],
      [0, width.value - height.value]
    );

    const backgroundColor = interpolateColor(
      Number(value.value),
      [0, 1],
      [theme.bg.strongPrimary, theme.bg.softPrimary]
    );

    return {
      backgroundColor: withTiming(backgroundColor, { duration }),
      transform: [{ translateX: withTiming(translateX, { duration }) }],
      borderRadius: height.value / 2,
    };
  });

  return (
    <Pressable onPress={onPress}>
      <Animated.View
        onLayout={(e) => {
          height.value = e.nativeEvent.layout.height;
          width.value = e.nativeEvent.layout.width;
        }}
        style={[
          switchStyles.track,
          style,
          trackAnimatedStyle,
          {
            borderColor: value.value
              ? theme.bg.strongPrimary
              : theme.bg.softPrimary,
          },
        ]}
      >
        <Animated.View
          style={[switchStyles.thumb, thumbAnimatedStyle]}
        ></Animated.View>
      </Animated.View>
    </Pressable>
  );
};

const switchStyles = StyleSheet.create({
  track: {
    justifyContent: 'center',
    width: 50,
    height: 25,
    padding: 3,
    borderWidth: 1,
  },
  thumb: {
    height: '100%',
    aspectRatio: 1,
  },
});

export default Switch;
