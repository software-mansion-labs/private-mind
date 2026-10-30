import React from 'react';
import { Image, LayoutChangeEvent, StyleSheet, View } from 'react-native';
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
import OnboardingCaption from './OnboardingCaption';
import { Theme, mixColors, withAlpha } from '../../styles/colors';
import {
  BADGE_LEAD,
  CARD_INSET,
  CROP_FADE,
  ILLUSTRATION_MAX_WIDTH,
  ILLUSTRATION_PARALLAX,
  ILLUSTRATION_SIDE_INSET,
  ILLUSTRATION_TOP_CLEARANCE,
  OnboardingSlide as Slide,
  TITLE_LEAD,
  WIDE_ILLUSTRATION_MAX_WIDTH,
} from '../../constants/onboarding';
import { useOnboardingLayout } from '../../hooks/useOnboardingLayout';

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
  const { isWide, isSplit, columnLeft, columnRight } = useOnboardingLayout();

  const anchoredTop = isWide || slide.illustration.anchor === 'top';
  const cropClearance = theme.insets.top + ILLUSTRATION_TOP_CLEARANCE;
  const splitBottomClearance = CARD_INSET + theme.insets.bottom;
  const fitsPage = pageWidth - ILLUSTRATION_SIDE_INSET * 2;
  const artAreaHeight = isSplit
    ? pageHeight - cropClearance - splitBottomClearance
    : pageHeight - cropClearance - illustrationBottom;
  const fitsHeight = artAreaHeight * slide.illustration.aspectRatio;
  const illustrationWidth = isWide
    ? Math.min(fitsPage, fitsHeight, WIDE_ILLUSTRATION_MAX_WIDTH)
    : Math.min(fitsPage, ILLUSTRATION_MAX_WIDTH);
  const anchoredPlacement = anchoredTop
    ? styles.zoneToScrim
    : [styles.zoneAboveText, { bottom: illustrationBottom }];
  const zonePlacement = isSplit
    ? [styles.zoneCentred, { bottom: splitBottomClearance }]
    : anchoredPlacement;
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
      opacity: isSplit
        ? 1
        : interpolate(
            scrollX.get(),
            [start, middle, end],
            [0, 1, 0],
            Extrapolation.CLAMP
          ),
      transform: [
        {
          translateX: isSplit
            ? 0
            : interpolate(
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

  const badgeStyle = useAnimatedStyle(() => {
    const travel = reducedMotion ? 0 : pageWidth * BADGE_LEAD;
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

  return (
    <View style={[styles.page, { width: pageWidth, height: pageHeight }]}>
      <View
        pointerEvents="none"
        style={[styles.illustrationZone, zonePlacement]}
      >
        <Animated.View style={illustrationStyle}>
          <Image
            source={slide.illustration.source}
            style={{
              width: illustrationWidth,
              height: illustrationWidth / slide.illustration.aspectRatio,
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

      {!isSplit && (
        <>
          <OnboardingScrim height={textTop} />
          <View
            style={[
              styles.textClip,
              { bottom: textBottom, left: columnLeft, right: columnRight },
            ]}
          >
            <OnboardingCaption
              slide={slide}
              badgeStyle={badgeStyle}
              titleStyle={titleStyle}
              onLayout={onTextLayout}
            />
          </View>
        </>
      )}
    </View>
  );
}

export default React.memo(OnboardingSlide);

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
    zoneCentred: {
      justifyContent: 'center',
    },
    cropFade: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
    },
    textClip: {
      position: 'absolute',
      overflow: 'hidden',
    },
  });
