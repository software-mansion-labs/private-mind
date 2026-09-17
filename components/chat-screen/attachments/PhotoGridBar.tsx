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
  PRESS_ANYWHERE,
  SPRING,
  panelPalette,
} from './constants';
import { Glass } from './Glass';
import SheetBar from './SheetBar';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ConfirmPillProps {
  count: number;
  active: boolean;
  fade: SharedValue<number>;
  onPress: () => void;
}

const ConfirmPill = ({ count, active, fade, onPress }: ConfirmPillProps) => {
  const { styles } = useThemedStyles(createStyles);
  const hasSelection = count > 0;
  const label = count === 1 ? 'Add 1 photo' : `Add ${count} photos`;

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
    width.set(
      width.get() === 0 ? labelWidth : withSpring(labelWidth, SPRING.pill)
    );
  }, [labelWidth, width]);
  const sizeStyle = useAnimatedStyle(() => ({
    width: width.get() + BOTTOM_BAR.pillPaddingHorizontal * 2,
  }));

  return (
    <View pointerEvents="box-none" style={styles.pillSlot}>
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
        pressRetentionOffset={PRESS_ANYWHERE}
        style={sizeStyle}
      >
        <Glass
          radius={BOTTOM_BAR.pillHeight / 2}
          active={active}
          scheme="dark"
          fade={fade}
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
  top: number;
  selected: string[];
  active: boolean;
  fade: SharedValue<number>;
  onBack: () => void;
  onConfirm: () => void;
}

const PhotoGridBar = ({
  width,
  top,
  selected,
  active,
  fade,
  onBack,
  onConfirm,
}: Props) => (
  <SheetBar width={width} top={top} active={active} fade={fade} onBack={onBack}>
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
      height: BOTTOM_BAR.pillHeight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillLabel: {
      color: palette.onControl,
      fontSize: BOTTOM_BAR.pillLabelSize,
      fontFamily: fontFamily.bold,
      fontVariant: ['tabular-nums'],
    },
    pillTint: {
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
