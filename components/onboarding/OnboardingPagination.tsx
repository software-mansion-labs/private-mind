import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  SharedValue,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import {
  DOT_ACTIVE_WIDTH,
  DOT_GAP,
  DOT_SIZE,
} from '../../constants/onboarding';

interface Props {
  count: number;
  activeIndex: number;
  scrollX: SharedValue<number>;
  pageWidth: number;
  onSelect: (index: number) => void;
}

interface DotProps {
  index: number;
  count: number;
  isActive: boolean;
  scrollX: SharedValue<number>;
  pageWidth: number;
  onSelect: (index: number) => void;
}

function Dot({
  index,
  count,
  isActive,
  scrollX,
  pageWidth,
  onSelect,
}: DotProps) {
  const { styles } = useThemedStyles(createStyles);

  const animatedStyle = useAnimatedStyle(() => {
    const range = [
      (index - 1) * pageWidth,
      index * pageWidth,
      (index + 1) * pageWidth,
    ];
    return {
      width: interpolate(
        scrollX.get(),
        range,
        [DOT_SIZE, DOT_ACTIVE_WIDTH, DOT_SIZE],
        Extrapolation.CLAMP
      ),
      opacity: interpolate(
        scrollX.get(),
        range,
        [0.4, 1, 0.4],
        Extrapolation.CLAMP
      ),
    };
  });

  return (
    <Pressable
      hitSlop={12}
      onPress={() => onSelect(index)}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={`Go to slide ${index + 1} of ${count}`}
    >
      <Animated.View style={[styles.dot, animatedStyle]} />
    </Pressable>
  );
}

function OnboardingPagination({
  count,
  activeIndex,
  scrollX,
  pageWidth,
  onSelect,
}: Props) {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.row}>
      {Array.from({ length: count }, (_, index) => (
        <Dot
          key={index}
          index={index}
          count={count}
          isActive={index === activeIndex}
          scrollX={scrollX}
          pageWidth={pageWidth}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}

export default OnboardingPagination;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: DOT_GAP,
      height: 24,
    },
    dot: {
      height: DOT_SIZE,
      borderRadius: DOT_SIZE / 2,
      backgroundColor: theme.bg.onBrandStrong,
    },
  });
