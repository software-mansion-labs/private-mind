import React from 'react';
import { Pressable, useWindowDimensions } from 'react-native';
import {
  useBottomSheet,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { BACKDROP_CLOSE_FADE } from '../../constants/bottom-sheet';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SheetBackdrop = ({
  animatedPosition,
  style,
}: BottomSheetBackdropProps) => {
  const { close } = useBottomSheet();
  const { theme } = useTheme();
  const { height: screenHeight } = useWindowDimensions();

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedPosition.value,
      [screenHeight - BACKDROP_CLOSE_FADE, screenHeight],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <AnimatedPressable
      onPress={() => close()}
      style={[style, { backgroundColor: theme.bg.overlay }, animatedStyle]}
    />
  );
};

export default SheetBackdrop;
