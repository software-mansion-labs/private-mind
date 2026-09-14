import React, { useCallback, useState } from 'react';
import { Image, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import OnboardingIntroPanel from '../../components/onboarding/OnboardingIntroPanel';
import OnboardingCarousel from '../../components/onboarding/OnboardingCarousel';
import { markOnboardingComplete } from '../../utils/onboardingStatus';
import { Feedback } from '../../utils/Feedback';
import { EMPHASIZED_DECELERATE } from '../../constants/motion';
import {
  CARD_INSET,
  INTRO_ILLUSTRATION,
  SPILL_DURATION,
} from '../../constants/onboarding';

const SPILL_EASING = Easing.bezier(...EMPHASIZED_DECELERATE);
const INTRO_CORNER_RADIUS = 10;

function OnboardingScreen() {
  const router = useRouter();
  const { styles, theme } = useThemedStyles(createStyles);
  const [showCarousel, setShowCarousel] = useState(false);
  const [introHeight, setIntroHeight] = useState(0);
  const spillProgress = useSharedValue(0);

  const leaveOnboarding = useCallback(() => {
    markOnboardingComplete();
    router.replace('/(modals)/select-starting-model');
  }, [router]);

  const completeOnboarding = useCallback(() => {
    Feedback.onboardingComplete();
    leaveOnboarding();
  }, [leaveOnboarding]);

  const openCarousel = useCallback(() => {
    spillProgress.set(
      withTiming(
        1,
        {
          duration: SPILL_DURATION,
          easing: SPILL_EASING,
          reduceMotion: ReduceMotion.System,
        },
        (finished) => {
          if (finished) runOnJS(setShowCarousel)(true);
        }
      )
    );
  }, [spillProgress]);

  const closeCarousel = useCallback(() => {
    setShowCarousel(false);
    spillProgress.set(
      withTiming(0, {
        duration: SPILL_DURATION,
        easing: SPILL_EASING,
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [spillProgress]);

  const handleIntroLayout = useCallback((event: LayoutChangeEvent) => {
    setIntroHeight(event.nativeEvent.layout.height);
  }, []);

  const spillStyle = useAnimatedStyle(() => {
    const restingBottom = introHeight + CARD_INSET;
    const spilled = restingBottom * spillProgress.get();

    return {
      top: Math.max(theme.insets.top + CARD_INSET - spilled, 0),
      left: Math.max(CARD_INSET - spilled, 0),
      right: Math.max(CARD_INSET - spilled, 0),
      bottom: restingBottom - spilled,
      borderRadius: Math.max(INTRO_CORNER_RADIUS - spilled, 0),
    };
  });

  return (
    <View style={styles.container}>
      <View style={styles.introPanel} onLayout={handleIntroLayout}>
        <OnboardingIntroPanel onPressStart={openCarousel} />
      </View>

      {introHeight > 0 && (
        <Animated.View style={[styles.brandBackdrop, spillStyle]}>
          {!showCarousel && (
            <Image
              source={INTRO_ILLUSTRATION}
              style={styles.introIllustration}
              resizeMode="contain"
            />
          )}
        </Animated.View>
      )}

      {showCarousel && (
        <OnboardingCarousel
          onSkip={leaveOnboarding}
          onComplete={completeOnboarding}
          onExitToIntro={closeCarousel}
        />
      )}
    </View>
  );
}

export default OnboardingScreen;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
    },
    brandBackdrop: {
      position: 'absolute',
      backgroundColor: theme.bg.main,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    introIllustration: {
      flex: 1,
      width: '100%',
    },
    introPanel: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: CARD_INSET,
      paddingBottom: CARD_INSET + theme.insets.bottom,
    },
  });
