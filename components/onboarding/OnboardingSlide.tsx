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
import MaskedView from '@react-native-masked-view/masked-view';
import { Theme, withAlpha } from '../../styles/colors';
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

const MASK_INK = '#000000';

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
  const cropMaskColors = [1, ...CROP_RAMP.map(([, cover]) => cover)].map(
    (cover) => withAlpha(MASK_INK, 1 - cover)
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

  const illustration = (
    <Animated.View style={illustrationStyle}>
      <Image
        source={slide.illustration.source}
        style={{
          width: illustrationWidth,
          height: illustrationWidth / slide.illustration.aspectRatio,
        }}
      />
    </Animated.View>
  );

  return (
    <View style={[styles.page, { width: pageWidth, height: pageHeight }]}>
      <View
        pointerEvents="none"
        style={[styles.illustrationZone, zonePlacement]}
      >
        {anchoredTop ? (
          illustration
        ) : (
          <MaskedView
            style={[styles.cropMask, isSplit && styles.cropMaskCentred]}
            maskElement={
              <View style={StyleSheet.absoluteFill}>
                <LinearGradient
                  colors={cropMaskColors}
                  locations={cropFadeLocations}
                  style={{ height: cropHeight }}
                />
                <View style={styles.cropMaskSolid} />
              </View>
            }
          >
            {illustration}
          </MaskedView>
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
    cropMask: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    cropMaskCentred: {
      justifyContent: 'center',
    },
    cropMaskSolid: {
      flex: 1,
      backgroundColor: MASK_INK,
    },
    textClip: {
      position: 'absolute',
      overflow: 'hidden',
    },
  });
