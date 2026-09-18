import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import { INTRO_FADE_MS, INTRO_LIFT } from '../../constants/onboarding';

const INTRO_EASING = Easing.bezier(...EMPHASIZED_DECELERATE);

function OnboardingScreen() {
  const router = useRouter();
  const { styles, theme } = useThemedStyles(createStyles);
  const [showCarousel, setShowCarousel] = useState(false);
  const introProgress = useSharedValue(1);

  const leaveOnboarding = useCallback(() => {
    markOnboardingComplete();
    router.replace('/(modals)/select-starting-model');
  }, [router]);

  const completeOnboarding = useCallback(() => {
    Feedback.onboardingComplete();
    leaveOnboarding();
  }, [leaveOnboarding]);

  const openCarousel = useCallback(() => {
    introProgress.set(
      withTiming(
        0,
        {
          duration: INTRO_FADE_MS,
          easing: INTRO_EASING,
          reduceMotion: ReduceMotion.System,
        },
        (finished) => {
          if (finished) runOnJS(setShowCarousel)(true);
        }
      )
    );
  }, [introProgress]);

  const closeCarousel = useCallback(() => {
    setShowCarousel(false);
    introProgress.set(
      withTiming(1, {
        duration: INTRO_FADE_MS,
        easing: INTRO_EASING,
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [introProgress]);

  const introStyle = useAnimatedStyle(() => ({
    opacity: introProgress.get(),
    transform: [{ translateY: (introProgress.get() - 1) * INTRO_LIFT }],
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.bg.softPrimary, theme.bg.main]}
        style={StyleSheet.absoluteFill}
      />

      {!showCarousel && (
        <Animated.View style={[StyleSheet.absoluteFill, introStyle]}>
          <OnboardingIntroPanel onPressStart={openCarousel} />
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
  });
