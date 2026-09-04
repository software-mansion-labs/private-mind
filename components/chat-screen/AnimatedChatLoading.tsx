import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes } from '../../styles/fontStyles';

const AnimatedChatLoading = ({ label = 'Thinking…' }: { label?: string }) => {
  const { styles } = useThemedStyles(createStyles);

  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.set(
      withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        -1,
        true
      )
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
  }));

  return (
    <Animated.Text style={[styles.label, animatedStyle]}>{label}</Animated.Text>
  );
};

export default AnimatedChatLoading;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    label: {
      fontSize: fontSizes.xs,
      fontFamily: fontFamily.medium,
      color: theme.text.defaultSecondary,
    },
  });
