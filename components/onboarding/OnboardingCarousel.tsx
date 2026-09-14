import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import PrimaryButton from '../PrimaryButton';
import SecondaryButton from '../SecondaryButton';
import OnboardingPagination from './OnboardingPagination';
import OnboardingSlide from './OnboardingSlide';
import {
  CARD_GAP,
  CARD_INSET,
  CARD_PADDING,
  CONTROLS_GAP,
  CONTROLS_HEIGHT,
  ILLUSTRATION_CLEARANCE,
  ONBOARDING_SLIDES,
} from '../../constants/onboarding';
import { Feedback } from '../../utils/Feedback';

interface Props {
  onSkip: () => void;
  onComplete: () => void;
  onExitToIntro: () => void;
}

const lastIndex = ONBOARDING_SLIDES.length - 1;

function OnboardingCarousel({ onSkip, onComplete, onExitToIntro }: Props) {
  const { styles, theme } = useThemedStyles(createStyles);
  const { width: pageWidth, height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useSharedValue(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [textAreaHeight, setTextAreaHeight] = useState(0);
  const [measuredHeight, setMeasuredHeight] = useState(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.set(event.contentOffset.x);
  });

  useAnimatedReaction(
    () => {
      const page = Math.round(scrollX.get() / pageWidth);
      return Math.min(Math.max(page, 0), lastIndex);
    },
    (current, previous) => {
      if (previous !== null && current !== previous) {
        runOnJS(setActiveIndex)(current);
      }
    }
  );

  const isFirstIndex = useRef(true);
  useEffect(() => {
    if (isFirstIndex.current) {
      isFirstIndex.current = false;
      return;
    }
    Feedback.onboardingStep();
  }, [activeIndex]);

  const goTo = useCallback(
    (index: number) => {
      scrollRef.current?.scrollTo({ x: index * pageWidth, animated: true });
    },
    [pageWidth]
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({
      x: activeIndex * pageWidth,
      animated: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageWidth]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (activeIndex > 0) {
          goTo(activeIndex - 1);
          return true;
        }
        onExitToIntro();
        return true;
      }
    );
    return () => subscription.remove();
  }, [activeIndex, goTo, onExitToIntro]);

  const handleContainerLayout = useCallback((event: LayoutChangeEvent) => {
    setMeasuredHeight(event.nativeEvent.layout.height);
  }, []);

  const handleTextLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setTextAreaHeight((current) => Math.max(current, height));
  }, []);

  const pageHeight = measuredHeight || windowHeight;
  const cardBottom = CARD_INSET + theme.insets.bottom;
  const cardHeight =
    CARD_PADDING * 2 + textAreaHeight + CARD_GAP + CONTROLS_HEIGHT;
  const textBottom = cardBottom + CARD_PADDING + CONTROLS_HEIGHT + CARD_GAP;
  const illustrationBottom = cardBottom + cardHeight + ILLUSTRATION_CLEARANCE;

  const activeSlide = ONBOARDING_SLIDES[activeIndex];
  const isLastSlide = activeIndex === lastIndex;

  const handleNext = () => {
    if (isLastSlide) {
      onComplete();
      return;
    }
    goTo(activeIndex + 1);
  };

  return (
    <Animated.View
      entering={FadeIn}
      style={styles.container}
      onLayout={handleContainerLayout}
    >
      <View style={[styles.card, { bottom: cardBottom, height: cardHeight }]} />

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        style={styles.scroll}
      >
        {ONBOARDING_SLIDES.map((slide, index) => (
          <OnboardingSlide
            key={slide.id}
            slide={slide}
            index={index}
            scrollX={scrollX}
            pageWidth={pageWidth}
            pageHeight={pageHeight}
            illustrationBottom={illustrationBottom}
            textBottom={textBottom}
            onTextLayout={handleTextLayout}
          />
        ))}
      </Animated.ScrollView>

      <View style={[styles.controls, { bottom: cardBottom + CARD_PADDING }]}>
        <OnboardingPagination
          count={ONBOARDING_SLIDES.length}
          activeIndex={activeIndex}
          scrollX={scrollX}
          pageWidth={pageWidth}
          onSelect={goTo}
        />
        {isLastSlide ? (
          <PrimaryButton text={activeSlide.buttonLabel} onPress={handleNext} />
        ) : (
          <SecondaryButton
            text={activeSlide.buttonLabel}
            onPress={handleNext}
            textStyle={styles.buttonText}
          />
        )}
      </View>

      <TouchableOpacity
        style={[styles.skip, { top: theme.insets.top + CARD_INSET }]}
        onPress={onSkip}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Skip onboarding"
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default OnboardingCarousel;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
    },
    scroll: {
      ...StyleSheet.absoluteFillObject,
    },
    card: {
      position: 'absolute',
      left: CARD_INSET,
      right: CARD_INSET,
      borderRadius: 18,
      backgroundColor: theme.bg.softPrimary,
    },
    controls: {
      position: 'absolute',
      left: CARD_INSET + CARD_PADDING,
      right: CARD_INSET + CARD_PADDING,
      gap: CONTROLS_GAP,
    },
    buttonText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
    },
    skip: {
      position: 'absolute',
      right: CARD_INSET,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    skipText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.onBrand,
    },
  });
