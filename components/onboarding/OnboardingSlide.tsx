import React from 'react';
import { Image, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  SharedValue,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import {
  DESCRIPTION_LEAD,
  GLOW_PARALLAX,
  GLOW_SIZE,
  ILLUSTRATION_MAX_WIDTH,
  ILLUSTRATION_PARALLAX,
  ILLUSTRATION_SIDE_INSET,
  ILLUSTRATION_TOP_CLEARANCE,
  OnboardingSlide as Slide,
  TITLE_LEAD,
} from '../../constants/onboarding';

interface Props {
  slide: Slide;
  index: number;
  scrollX: SharedValue<number>;
  pageWidth: number;
  pageHeight: number;
  illustrationBottom: number;
  textBottom: number;
  onTextLayout: (event: LayoutChangeEvent) => void;
}

function OnboardingSlide({
  slide,
  index,
  scrollX,
  pageWidth,
  pageHeight,
  illustrationBottom,
  textBottom,
  onTextLayout,
}: Props) {
  const { styles } = useThemedStyles(createStyles);
  const reducedMotion = useReducedMotion();

  const illustrationWidth = Math.min(
    pageWidth - ILLUSTRATION_SIDE_INSET * 2,
    ILLUSTRATION_MAX_WIDTH
  );

  const start = (index - 1) * pageWidth;
  const middle = index * pageWidth;
  const end = (index + 1) * pageWidth;

  const glowStyle = useAnimatedStyle(() => {
    const travel = reducedMotion ? 0 : pageWidth * GLOW_PARALLAX;
    return {
      opacity: interpolate(
        scrollX.get(),
        [start, middle, end],
        [0, 0.1, 0],
        Extrapolation.CLAMP
      ),
      transform: [
        {
          translateX: interpolate(
            scrollX.get(),
            [start, middle, end],
            [-travel, 0, travel],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  const illustrationStyle = useAnimatedStyle(() => {
    const travel = reducedMotion ? 0 : pageWidth * ILLUSTRATION_PARALLAX;
    return {
      opacity: interpolate(
        scrollX.get(),
        [start, middle, end],
        [0, 1, 0],
        Extrapolation.CLAMP
      ),
      transform: [
        {
          translateX: interpolate(
            scrollX.get(),
            [start, middle, end],
            [-travel, 0, travel],
            Extrapolation.CLAMP
          ),
        },
        {
          scale: reducedMotion
            ? 1
            : interpolate(
                scrollX.get(),
                [start, middle, end],
                [0.86, 1, 0.86],
                Extrapolation.CLAMP
              ),
        },
      ],
    };
  });

  const titleStyle = useAnimatedStyle(() => {
    const travel = reducedMotion ? 0 : pageWidth * TITLE_LEAD;
    return {
      opacity: interpolate(
        scrollX.get(),
        [start, middle, end],
        [0, 1, 0],
        Extrapolation.CLAMP
      ),
      transform: [
        {
          translateX: interpolate(
            scrollX.get(),
            [start, middle, end],
            [-travel, 0, travel],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  const descriptionStyle = useAnimatedStyle(() => {
    const travel = reducedMotion ? 0 : pageWidth * DESCRIPTION_LEAD;
    return {
      opacity: interpolate(
        scrollX.get(),
        [start, middle, end],
        [0, 1, 0],
        Extrapolation.CLAMP
      ),
      transform: [
        {
          translateX: interpolate(
            scrollX.get(),
            [start, middle, end],
            [-travel, 0, travel],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  return (
    <View style={[styles.page, { width: pageWidth, height: pageHeight }]}>
      <View
        pointerEvents="none"
        style={[
          styles.illustrationZone,
          { bottom: illustrationBottom },
          slide.illustration.anchor === 'bottom'
            ? styles.anchorBottom
            : styles.anchorTop,
        ]}
      >
        <Animated.View style={[styles.glow, glowStyle]} />
        <Animated.View style={illustrationStyle}>
          <Image
            source={slide.illustration.source}
            style={{
              width: illustrationWidth,
              aspectRatio: slide.illustration.aspectRatio,
            }}
          />
        </Animated.View>
      </View>

      <View
        style={[styles.textBlock, { bottom: textBottom }]}
        onLayout={onTextLayout}
        accessible
        accessibilityLabel={`${slide.label}. ${slide.title}. ${slide.description}`}
      >
        <Animated.View style={[styles.textGroup, titleStyle]}>
          <View style={styles.labelBadge}>
            <Text style={styles.labelText}>{slide.label}</Text>
          </View>
          <Text style={styles.title}>{slide.title}</Text>
        </Animated.View>
        <Animated.Text style={[styles.description, descriptionStyle]}>
          {slide.description}
        </Animated.Text>
      </View>
    </View>
  );
}

export default OnboardingSlide;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    page: {
      overflow: 'hidden',
    },
    illustrationZone: {
      position: 'absolute',
      top: theme.insets.top + ILLUSTRATION_TOP_CLEARANCE,
      left: 0,
      right: 0,
      alignItems: 'center',
      overflow: 'hidden',
    },
    anchorTop: {
      justifyContent: 'flex-start',
    },
    anchorBottom: {
      justifyContent: 'flex-end',
    },
    glow: {
      position: 'absolute',
      top: 0,
      width: GLOW_SIZE,
      height: GLOW_SIZE,
      borderRadius: GLOW_SIZE / 2,
      backgroundColor: theme.bg.onBrandStrong,
    },
    textBlock: {
      position: 'absolute',
      left: 32,
      right: 32,
      alignItems: 'center',
      gap: 16,
    },
    textGroup: {
      alignItems: 'center',
      gap: 16,
    },
    labelBadge: {
      backgroundColor: theme.bg.softSecondary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    labelText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      textAlign: 'center',
      color: theme.text.primary,
    },
    title: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.lg,
      lineHeight: lineHeights.lg,
      textAlign: 'center',
      color: theme.text.primary,
    },
    description: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      textAlign: 'center',
      color: theme.text.defaultSecondary,
    },
  });
