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

/**
 * Slim "Thinking…" indicator shown in the assistant bubble's modelName
 * slot while the model is processing the prompt. Matches the modelName
 * text style exactly so swapping it for the real model name when the
 * first token arrives causes no layout shift.
 */
const AnimatedChatLoading = ({
  label = 'Thinking…',
  inline = false,
}: {
  label?: string;
  inline?: boolean;
}) => {
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
    <Animated.Text
      style={[styles.label, inline && styles.inline, animatedStyle]}
    >
      {label}
    </Animated.Text>
  );
};

export default AnimatedChatLoading;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    label: {
      // Absolutely positioned so the label is visible but contributes
      // zero height to the assistant bubble's layout. Keeps the
      // user message pinned at the top while we wait for the first
      // token to arrive.
      position: 'absolute',
      top: 0,
      left: 0,
      fontSize: fontSizes.xs,
      fontFamily: fontFamily.medium,
      color: theme.text.defaultSecondary,
    },
    inline: {
      position: 'relative',
    },
  });
