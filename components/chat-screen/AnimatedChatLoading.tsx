import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';

const AnimatedChatLoading = () => {
  const progress = useSharedValue(0);
  progress.value = withRepeat(withTiming(1, { duration: 500 }), -1, true);

  const { theme } = useTheme();

  const animatedStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: interpolateColor(
        progress.value,
        [0, 1],
        ['rgba(2, 15, 60, 1', 'rgba(2, 15, 60, 0.5)', 'rgba(2, 15, 60, 0.25)']
      ),
    };
  });

  return (
    <View
      style={{
        ...styles.messageLoadingContainer,
        backgroundColor: theme.bg.softSecondary,
      }}
    >
      <Animated.View style={[styles.loadingDot, animatedStyle]} />
      <Animated.View style={[styles.loadingDot, animatedStyle]} />
      <Animated.View style={[styles.loadingDot, animatedStyle]} />
    </View>
  );
};

export default AnimatedChatLoading;

const styles = StyleSheet.create({
  messageLoadingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: 56,
    height: 32,
    borderRadius: 16,
    padding: 8,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
