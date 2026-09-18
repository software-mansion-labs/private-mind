import React from 'react';
import { Image, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  SharedValue,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import OnboardingScrim from './OnboardingScrim';
import { Theme, mixColors, withAlpha } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import {
  CARD_INSET,
  CONTENT_PADDING,
  CROP_FADE,
  DESCRIPTION_LEAD,
  ILLUSTRATION_MAX_WIDTH,
  ILLUSTRATION_PARALLAX,
  ILLUSTRATION_SIDE_INSET,
  ILLUSTRATION_TOP_CLEARANCE,
  LABEL_ICON_SIZE,
  OnboardingSlide as Slide,
  TITLE_LEAD,
} from '../../constants/onboarding';

const CROP_RAMP: [number, number][] = [
  [0, 1],
  [0.25, 0.844],
  [0.5, 0.5],
  [0.75, 0.156],
  [1, 0],
];

interface Props {
  slide: Slide;
  index: number;
  scrollX: SharedValue<number>;
  pageWidth: number;
  pageHeight: number;
  illustrationBottom: number;
  textBottom: number;
  textTop: number;
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
  textTop,
  onTextLayout,
}: Props) {
  const { styles, theme } = useThemedStyles(createStyles);
  const reducedMotion = useReducedMotion();

  const illustrationWidth = Math.min(
    pageWidth - ILLUSTRATION_SIDE_INSET * 2,
    ILLUSTRATION_MAX_WIDTH
  );

  const Icon = slide.icon.art;
  const anchoredTop = slide.illustration.anchor === 'top';
  const cropClearance = theme.insets.top + ILLUSTRATION_TOP_CLEARANCE;
  const cropHeight = cropClearance + CROP_FADE;
  const clearStop = cropClearance / cropHeight;
  const cropFadeLocations = [
    0,
    ...CROP_RAMP.map(([at]) => clearStop + (1 - clearStop) * at),
  ] as [number, number, ...number[]];
  const cropFadeColors = [1, ...CROP_RAMP.map(([, alpha]) => alpha)].map(
    (alpha, stop) =>
      withAlpha(
        mixColors(
          theme.bg.softPrimary,
          theme.bg.main,
          (cropFadeLocations[stop] * cropHeight) / pageHeight
        ),
        alpha
      )
  ) as [string, string, ...string[]];

  const start = (index - 1) * pageWidth;
  const middle = index * pageWidth;
  const end = (index + 1) * pageWidth;

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
          anchoredTop
            ? styles.zoneToScrim
            : [styles.zoneAboveText, { bottom: illustrationBottom }],
        ]}
      >
        <Animated.View style={illustrationStyle}>
          <Image
            source={slide.illustration.source}
            style={{
              width: illustrationWidth,
              aspectRatio: slide.illustration.aspectRatio,
            }}
          />
        </Animated.View>
        {!anchoredTop && (
          <LinearGradient
            colors={cropFadeColors}
            locations={cropFadeLocations}
            style={[styles.cropFade, { height: cropHeight }]}
            pointerEvents="none"
          />
        )}
      </View>

      <OnboardingScrim height={textTop} />

      <View style={[styles.textClip, { bottom: textBottom }]}>
        <View
          style={styles.textBlock}
          onLayout={onTextLayout}
          accessible
          accessibilityLabel={`${slide.label}. ${slide.title}. ${slide.description}`}
        >
          <Animated.View style={[styles.textGroup, titleStyle]}>
            <View style={styles.labelBadge}>
              <Icon
                width={LABEL_ICON_SIZE * slide.icon.aspectRatio}
                height={LABEL_ICON_SIZE}
                style={styles.labelIcon}
              />
              <Text style={styles.labelText}>{slide.label}</Text>
            </View>
            <Text style={styles.title}>{slide.title}</Text>
          </Animated.View>
          <Animated.Text style={[styles.description, descriptionStyle]}>
            {slide.description}
          </Animated.Text>
        </View>
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
    zoneToScrim: {
      bottom: 0,
      justifyContent: 'flex-start',
    },
    zoneAboveText: {
      top: 0,
      justifyContent: 'flex-end',
    },
    cropFade: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
    },
    textClip: {
      position: 'absolute',
      left: CARD_INSET,
      right: CARD_INSET,
      overflow: 'hidden',
    },
    textBlock: {
      paddingHorizontal: CONTENT_PADDING,
      alignItems: 'center',
      gap: 12,
    },
    textGroup: {
      alignItems: 'center',
      gap: 12,
    },
    labelBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.bg.onBrandSoft,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    labelIcon: {
      color: theme.text.onBrand,
    },
    labelText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      textAlign: 'center',
      color: theme.text.onBrand,
    },
    title: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xxl,
      lineHeight: lineHeights.xxl,
      textAlign: 'center',
      color: theme.text.onBrand,
    },
    description: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      textAlign: 'center',
      color: theme.text.onBrandMuted,
    },
  });
