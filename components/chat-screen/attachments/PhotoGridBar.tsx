import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { Theme } from '../../../styles/colors';
import { fontFamily } from '../../../styles/fontStyles';
import {
  BOTTOM_BAR,
  DURATION,
  EASE_FADE,
  SPRING,
  panelPalette,
} from './constants';
import { Glass } from './Glass';
import SheetBar from './SheetBar';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ConfirmPillProps {
  count: number;
  active: boolean;
  /** Fades the labels with the grid. Glass can only be faded from the inside. */
  fade: SharedValue<number>;
  onPress: () => void;
}

/**
 * "All Photos" ⇄ "Add N photos". One glass capsule, never faded — the blue is a
 * plain view laid over it and the labels crossfade on top. The width comes from
 * a hidden copy of the current label: it reports its width and the capsule
 * springs to it, pinned to the bar's trailing edge.
 */
const ConfirmPill = ({ count, active, fade, onPress }: ConfirmPillProps) => {
  const { styles } = useThemedStyles(createStyles);
  const hasSelection = count > 0;
  const label = count === 1 ? 'Add 1 photo' : `Add ${count} photos`;

  // Driven through a derived value rather than `withTiming` straight in the
  // style: multiplying an animation descriptor by the grid's fade gives NaN.
  const swap = useDerivedValue(() =>
    withTiming(hasSelection ? 1 : 0, {
      duration: DURATION.pill,
      easing: EASE_FADE,
    })
  );
  const plain = useAnimatedStyle(() => ({
    opacity: (1 - swap.get()) * fade.get(),
  }));
  const tinted = useAnimatedStyle(() => ({
    opacity: swap.get() * fade.get(),
  }));

  const [labelWidth, setLabelWidth] = useState(0);
  const width = useSharedValue(0);
  useEffect(() => {
    if (!labelWidth) return;
    // The first measurement has nothing to move from, so it lands outright.
    width.set(
      width.get() === 0 ? labelWidth : withSpring(labelWidth, SPRING.pill)
    );
  }, [labelWidth, width]);
  const sizeStyle = useAnimatedStyle(() => ({
    width: width.get() + BOTTOM_BAR.pillPaddingHorizontal * 2,
  }));

  return (
    // Full width, contents pushed to the trailing edge: the slot holds the
    // capsule's right edge still and gives the sizer room to measure in.
    <View pointerEvents="box-none" style={styles.pillSlot}>
      {/* Measures the label; never painted, never sizes anything itself. */}
      <Text
        numberOfLines={1}
        onLayout={(event) => setLabelWidth(event.nativeEvent.layout.width)}
        style={[styles.pillLabel, styles.pillSizer]}
      >
        {hasSelection ? label : 'All Photos'}
      </Text>

      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={hasSelection ? label : 'All photos'}
        testID="attachment-confirm"
        disabled={!hasSelection}
        onPress={onPress}
        style={sizeStyle}
      >
        <Glass
          radius={BOTTOM_BAR.pillHeight / 2}
          active={active}
          duration={DURATION.crossfade / 1000}
          style={styles.pill}
        >
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.pillTint, tinted]}
          />
          <Animated.Text
            numberOfLines={1}
            style={[styles.pillLabel, styles.pillText, plain]}
          >
            All Photos
          </Animated.Text>
          <Animated.Text
            numberOfLines={1}
            style={[styles.pillLabel, styles.pillText, tinted]}
          >
            {label}
          </Animated.Text>
        </Glass>
      </AnimatedPressable>
    </View>
  );
};

interface Props {
  width: number;
  selected: string[];
  active: boolean;
  fade: SharedValue<number>;
  onBack: () => void;
  onConfirm: () => void;
}

/** The confirm capsule that floats over the grid, on the shared `SheetBar`. */
const PhotoGridBar = ({
  width,
  selected,
  active,
  fade,
  onBack,
  onConfirm,
}: Props) => (
  <SheetBar width={width} active={active} fade={fade} onBack={onBack}>
    <ConfirmPill
      count={selected.length}
      active={active}
      fade={fade}
      onPress={onConfirm}
    />
  </SheetBar>
);

export default PhotoGridBar;

const createStyles = (theme: Theme) => {
  const palette = panelPalette(theme);
  return StyleSheet.create({
    pillSlot: {
      flex: 1,
      alignItems: 'flex-end',
    },
    pill: {
      // Fills the button rather than sizing it, so the width being sprung is
      // the one the glass wears.
      height: BOTTOM_BAR.pillHeight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillLabel: {
      color: palette.text,
      fontSize: BOTTOM_BAR.pillLabelSize,
      fontFamily: fontFamily.bold,
      // Tabular figures: the capsule only resizes when the count gains a digit.
      fontVariant: ['tabular-nums'],
    },
    pillTint: {
      // Carries its own shape: the glass underneath does not clip its children,
      // so an interactive press can bulge past the capsule's edge.
      borderRadius: BOTTOM_BAR.pillHeight / 2,
      borderCurve: 'continuous',
      backgroundColor: palette.accent,
    },
    pillSizer: {
      position: 'absolute',
      left: 0,
      opacity: 0,
    },
    pillText: {
      position: 'absolute',
      left: 0,
      right: 0,
      textAlign: 'center',
    },
  });
};
