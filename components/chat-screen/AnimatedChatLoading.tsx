import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';

const AnimatedChatLoading = () => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const progress = useSharedValue(0);
  progress.value = withRepeat(withTiming(1, { duration: 500 }), -1, true);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 0.5, 1],
      ['rgba(2, 15, 60, 1)', 'rgba(2, 15, 60, 0.5)', 'rgba(2, 15, 60, 0.25)']
    ),
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.dot, animatedStyle]} />
      <Animated.View style={[styles.dot, animatedStyle]} />
      <Animated.View style={[styles.dot, animatedStyle]} />
    </View>
  );
};

export default AnimatedChatLoading;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      width: 56,
      height: 32,
      borderRadius: 16,
      padding: 8,
      backgroundColor: theme.bg.softSecondary,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
  });
