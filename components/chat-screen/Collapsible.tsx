import React, {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export const COLLAPSIBLE_TRANSITION_MS = 260;

const TRANSITION = {
  duration: COLLAPSIBLE_TRANSITION_MS,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
};

interface Props {
  expanded: boolean;
  growsWithContent?: boolean;
  children: ReactNode;
}

const Collapsible = ({
  expanded,
  growsWithContent = false,
  children,
}: Props) => {
  const height = useSharedValue(0);
  const measuredHeight = useRef(0);
  const [mounted, setMounted] = useState(expanded);
  if (expanded && !mounted) setMounted(true);

  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const unmountOnceCollapsed = useCallback(() => {
    if (expandedRef.current) return;
    measuredHeight.current = 0;
    setMounted(false);
  }, []);

  useEffect(() => {
    if (expanded) return;
    height.set(
      withTiming(0, TRANSITION, (finished) => {
        if (finished) runOnJS(unmountOnceCollapsed)();
      })
    );
  }, [expanded, height, unmountOnceCollapsed]);

  const handleContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const next = event.nativeEvent.layout.height;
      if (next <= 0 || !expandedRef.current) return;
      const alreadyOpen = measuredHeight.current > 0;
      measuredHeight.current = next;
      height.set(
        growsWithContent && alreadyOpen ? next : withTiming(next, TRANSITION)
      );
    },
    [growsWithContent, height]
  );

  const clipStyle = useAnimatedStyle(() => ({ height: height.get() }));

  if (!mounted) return null;

  return (
    <Animated.View style={[styles.clip, clipStyle]}>
      <View style={styles.content} onLayout={handleContentLayout}>
        {children}
      </View>
    </Animated.View>
  );
};

export default Collapsible;

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
