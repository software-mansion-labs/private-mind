import React from 'react';
import { LayoutChangeEvent, StyleSheet } from 'react-native';
import {
  Extrapolation,
  SharedValue,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
} from 'react-native-reanimated';
import OnboardingCaption from './OnboardingCaption';
import {
  CAPTION_BADGE_SHIFT,
  CAPTION_TITLE_SHIFT,
  OnboardingSlide as Slide,
} from '../../constants/onboarding';

interface Props {
  slide: Slide;
  index: number;
  isActive: boolean;
  scrollX: SharedValue<number>;
  pageWidth: number;
  onTextLayout: (event: LayoutChangeEvent) => void;
}

function useHandoffStyle(
  scrollX: SharedValue<number>,
  index: number,
  pageWidth: number,
  shift: number
) {
  const reducedMotion = useReducedMotion();
  const middle = index * pageWidth;
  const halfPage = pageWidth / 2;

  return useAnimatedStyle(() => {
    const travel = reducedMotion ? 0 : shift;
    const range = [middle - halfPage, middle, middle + halfPage];
    return {
      opacity: interpolate(
        scrollX.get(),
        range,
        [0, 1, 0],
        Extrapolation.CLAMP
      ),
      transform: [
        {
          translateX: interpolate(
            scrollX.get(),
            range,
            [travel, 0, -travel],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });
}

function OnboardingSplitCaption({
  slide,
  index,
  isActive,
  scrollX,
  pageWidth,
  onTextLayout,
}: Props) {
  const badgeStyle = useHandoffStyle(
    scrollX,
    index,
    pageWidth,
    CAPTION_BADGE_SHIFT
  );
  const titleStyle = useHandoffStyle(
    scrollX,
    index,
    pageWidth,
    CAPTION_TITLE_SHIFT
  );

  return (
    <OnboardingCaption
      slide={slide}
      leading
      isActive={isActive}
      style={styles.stacked}
      badgeStyle={badgeStyle}
      titleStyle={titleStyle}
      onLayout={onTextLayout}
    />
  );
}

export default React.memo(OnboardingSplitCaption);

const styles = StyleSheet.create({
  stacked: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
