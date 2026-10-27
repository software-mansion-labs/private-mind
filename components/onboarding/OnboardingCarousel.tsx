import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
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
import OnboardingSplitCaption from './OnboardingSplitCaption';
import { useOnboardingLayout } from '../../hooks/useOnboardingLayout';
import {
  CARD_INSET,
  CONTENT_PADDING,
  CONTROLS_GAP,
  CONTROLS_HEIGHT,
  ILLUSTRATION_CLEARANCE,
  ONBOARDING_SLIDES,
  TEXT_CONTROLS_GAP,
} from '../../constants/onboarding';
import { Feedback } from '../../utils/Feedback';
import { pressedOpacity } from '../../styles/pressable';

interface Props {
  onSkip: () => void;
  onComplete: () => void;
  onExitToIntro: () => void;
}

const lastIndex = ONBOARDING_SLIDES.length - 1;

function OnboardingCarousel({ onSkip, onComplete, onExitToIntro }: Props) {
  const { styles, theme } = useThemedStyles(createStyles);
  const { width: screenWidth, height: windowHeight } = useWindowDimensions();
  const { isSplit, panelWidth, columnLeft, columnRight } =
    useOnboardingLayout();
  const pageWidth = isSplit ? screenWidth - panelWidth : screenWidth;
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
  const splitGroupHeight = textAreaHeight + TEXT_CONTROLS_GAP + CONTROLS_HEIGHT;
  const controlsBottom = isSplit
    ? Math.max((pageHeight - splitGroupHeight) / 2, CARD_INSET)
    : CARD_INSET + theme.insets.bottom;
  const textBottom = controlsBottom + CONTROLS_HEIGHT + TEXT_CONTROLS_GAP;
  const textTop = textBottom + textAreaHeight;
  const illustrationBottom = textTop + ILLUSTRATION_CLEARANCE;

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
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled={!isSplit}
        snapToInterval={isSplit ? pageWidth : undefined}
        decelerationRate={isSplit ? 'fast' : 'normal'}
        disableIntervalMomentum
        contentContainerStyle={isSplit && { paddingRight: panelWidth }}
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
            textTop={textTop}
            onTextLayout={handleTextLayout}
          />
        ))}
      </Animated.ScrollView>

      {isSplit && (
        <View
          pointerEvents="none"
          style={[styles.splitPanel, { width: panelWidth }]}
        >
          <View
            style={[
              styles.splitCaptions,
              {
                left: columnLeft - (screenWidth - panelWidth),
                right: columnRight,
                bottom: textBottom,
                height: textAreaHeight,
              },
            ]}
          >
            {ONBOARDING_SLIDES.map((slide, index) => (
              <OnboardingSplitCaption
                key={slide.id}
                slide={slide}
                index={index}
                isActive={index === activeIndex}
                scrollX={scrollX}
                pageWidth={pageWidth}
                onTextLayout={handleTextLayout}
              />
            ))}
          </View>
        </View>
      )}

      <View
        style={[
          styles.controls,
          {
            bottom: controlsBottom,
            left: columnLeft + CONTENT_PADDING,
            right: columnRight + CONTENT_PADDING,
          },
        ]}
      >
        <View style={isSplit && styles.leading}>
          <OnboardingPagination
            count={ONBOARDING_SLIDES.length}
            activeIndex={activeIndex}
            scrollX={scrollX}
            pageWidth={pageWidth}
            onSelect={goTo}
          />
        </View>
        {isLastSlide ? (
          <PrimaryButton text={activeSlide.buttonLabel} onPress={handleNext} />
        ) : (
          <SecondaryButton
            text={activeSlide.buttonLabel}
            onPress={handleNext}
            style={styles.secondaryButton}
            textStyle={styles.buttonText}
          />
        )}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.skip,
          { top: theme.insets.top + CARD_INSET },
          pressed && pressedOpacity,
        ]}
        onPress={onSkip}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Skip onboarding"
      >
        <Text style={[styles.skipText, isSplit && styles.skipTextOnPanel]}>
          Skip
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default OnboardingCarousel;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFill,
    },
    scroll: {
      ...StyleSheet.absoluteFill,
    },
    splitPanel: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.bg.onBrandShadow,
    },
    splitCaptions: {
      position: 'absolute',
    },
    controls: {
      position: 'absolute',
      gap: CONTROLS_GAP,
    },
    leading: {
      alignItems: 'flex-start',
    },
    secondaryButton: {
      borderColor: theme.bg.onBrandStrong,
    },
    buttonText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      color: theme.text.onBrand,
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
      color: theme.text.primary,
    },
    skipTextOnPanel: {
      color: theme.text.onBrand,
    },
  });
