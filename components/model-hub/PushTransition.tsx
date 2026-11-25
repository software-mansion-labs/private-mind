import React, { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { EMPHASIZED_STANDARD } from '../../constants/motion';
import { PUSH_TRANSITION_MS } from '../../constants/push-transition';

const PUSH_EASING = Easing.bezier(...EMPHASIZED_STANDARD);

interface Props {
  showSecond: boolean;
  first: ReactNode;
  second: ReactNode;
}

const PushTransition = ({ showSecond, first, second }: Props) => {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(showSecond ? 1 : 0);
  const width = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(showSecond ? 1 : 0, {
      duration: reducedMotion ? 0 : PUSH_TRANSITION_MS,
      easing: PUSH_EASING,
    });
  }, [showSecond, reducedMotion, progress]);

  const handleLayout = (event: LayoutChangeEvent) => {
    width.value = event.nativeEvent.layout.width;
  };

  const firstStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -progress.value * width.value }],
  }));

  const secondStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - progress.value) * width.value }],
  }));

  return (
    <View style={styles.clip} onLayout={handleLayout}>
      <Animated.View
        style={[styles.pane, firstStyle]}
        pointerEvents={showSecond ? 'none' : 'auto'}
        accessibilityElementsHidden={showSecond}
        importantForAccessibility={showSecond ? 'no-hide-descendants' : 'auto'}
        testID="push-transition-first"
      >
        {first}
      </Animated.View>
      <Animated.View
        style={[styles.pane, secondStyle]}
        pointerEvents={showSecond ? 'auto' : 'none'}
        accessibilityElementsHidden={!showSecond}
        importantForAccessibility={showSecond ? 'auto' : 'no-hide-descendants'}
        testID="push-transition-second"
      >
        {second}
      </Animated.View>
    </View>
  );
};

export default PushTransition;

const styles = StyleSheet.create({
  clip: {
    flex: 1,
    overflow: 'hidden',
  },
  pane: {
    ...StyleSheet.absoluteFill,
  },
});
