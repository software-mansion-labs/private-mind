import React, {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';
import {
  Dimensions,
  Image,
  ImageSourcePropType,
  StyleSheet,
  View,
  BackHandler,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import OnboardingIntroPanel from '../../components/onboarding/OnboardingIntroPanel';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import CloseButton from '../../components/onboarding/CloseButton';
import OnboardingStepPanel, {
  OnboardingStepPanelProps,
} from '../../components/onboarding/OnboardingStepPanel';
import { useRouter } from 'expo-router';
import { markOnboardingComplete } from '../../utils/onboardingStatus';

interface Props {}

const SCREEN_HEIGHT = Dimensions.get('screen').height;

type PanelStepProps = Omit<
  OnboardingStepPanelProps,
  'onBackPress' | 'onNextPress' | 'buttonPrimary'
>;
const STEPS: (PanelStepProps & {
  image: ImageSourcePropType;
  alignment: 'center' | 'bottom';
})[] = [
  {
    label: 'Offline AI access',
    title: 'Chat with AI models offline',
    description:
      'Interact with AI models securely and offline on your mobile device.',
    buttonLabel: 'Got it, next',
    image: require('../../assets/onboarding/step_chat.png'),
    alignment: 'center',
  },
  {
    label: 'Performance tests',
    title: 'Benchmark your models',
    description:
      'Easily test out how AI models perform while being benchmarked.',
    buttonLabel: 'Nice, next',
    image: require('../../assets/onboarding/step_benchmark.png'),
    alignment: 'center',
  },
  {
    label: 'AI RAG',
    title: 'Add source documents',
    description: 'Use extra files to extend models knowledge and responses.',
    buttonLabel: 'Great, next',
    image: require('../../assets/onboarding/step_sources.png'),
    alignment: 'bottom',
  },
  {
    label: 'Speech to text',
    title: 'Use voice instead of chat',
    description: 'Use voice messages that automatically transcript into text.',
    buttonLabel: 'Awesome, next',
    image: require('../../assets/onboarding/step_voice.png'),
    alignment: 'bottom',
  },
  {
    label: 'Custom models',
    title: 'Upload extra models',
    description:
      'Add custom AI models like DeepSeek, OpenAI, or your custom ones.',
    buttonLabel: 'Start chatting',
    image: require('../../assets/onboarding/step_models.png'),
    alignment: 'center',
  },
];

function OnboardingScreen({}: Props) {
  const router = useRouter();
  const closeOnboarding = () => {
    markOnboardingComplete();
    router.dismissTo('/');
  };

  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const bgSpillProgress = useSharedValue(0);

  const [stepNumber, setStepNumber] = useState(0);
  const step = stepNumber > 0 ? STEPS[stepNumber - 1] : null;

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (stepNumber > 1) {
          // Go to previous onboarding step
          setStepNumber(stepNumber - 1);
          return true; // Prevent default back action
        } else if (stepNumber === 1) {
          // Go back to intro panel
          bgSpillProgress.value = withTiming(0, { duration: 500 });
          setTimeout(() => setStepNumber(0), 500);
          return true; // Prevent default back action
        }
        // stepNumber === 0 (intro panel) - allow default back action
        return false;
      }
    );

    return () => backHandler.remove();
  }, [stepNumber, bgSpillProgress]);

  const introPanel = useMeasureHeight();
  const stepPanel = useMeasureHeight();

  const initialBgBottom = introPanel.height + 16;
  const bgDistance = useDerivedValue(() =>
    interpolate(bgSpillProgress.value, [0, 1], [0, initialBgBottom])
  );

  const divider = useDerivedValue(
    () => SCREEN_HEIGHT - initialBgBottom + bgDistance.value
  );

  const colorBgAnimation = useAnimatedStyle(() => {
    const topEdge = Math.max(theme.insets.top + 16 - bgDistance.value, 0);
    const sideEdge = Math.max(16 - bgDistance.value, 0);

    return {
      position: 'absolute',
      top: topEdge,
      left: sideEdge,
      right: sideEdge,
      bottom: SCREEN_HEIGHT - divider.value,
      borderRadius: Math.max(10 - bgDistance.value, 0),
    };
  });

  const imageAnimation = useAnimatedStyle(() => ({
    height: divider.value,
  }));

  return (
    <View style={styles.container}>
      <View ref={introPanel.ref} style={styles.bottomPanel}>
        <OnboardingIntroPanel
          onPressStart={() => {
            bgSpillProgress.value = withTiming(1, { duration: 500 });
            setTimeout(() => setStepNumber(1), 500);
          }}
        />
      </View>

      <Animated.View style={[styles.colorBg, colorBgAnimation]} />
      <Animated.View style={[styles.imageWrapper, imageAnimation]}>
        <View
          style={[
            styles.innerImageWrapper,
            step?.alignment === 'bottom'
              ? {
                  justifyContent: 'flex-end',
                  bottom: stepPanel.height + 8,
                }
              : { justifyContent: 'center' },
          ]}
        >
          <Image source={step?.image ?? STEPS[0].image} />
        </View>
      </Animated.View>

      {step && (
        <>
          <Animated.View entering={FadeIn} style={styles.close}>
            <CloseButton onPress={closeOnboarding} />
          </Animated.View>

          <Animated.View
            ref={stepPanel.ref}
            entering={FadeInDown}
            style={styles.bottomPanel}
          >
            <OnboardingStepPanel
              label={step.label}
              title={step.title}
              description={step.description}
              buttonLabel={step.buttonLabel}
              onBackPress={
                stepNumber > 1 ? () => setStepNumber(stepNumber - 1) : undefined
              }
              onNextPress={() => {
                if (stepNumber < STEPS.length) {
                  setStepNumber(stepNumber + 1);
                } else {
                  closeOnboarding();
                }
              }}
              buttonPrimary={stepNumber === STEPS.length}
            />
          </Animated.View>
        </>
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
    colorBg: {
      backgroundColor: theme.bg.main,
    },
    imageWrapper: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      overflow: 'hidden',
    },
    innerImageWrapper: {
      alignItems: 'center',
      height: SCREEN_HEIGHT,
    },
    bottomPanel: {
      padding: 16,
      paddingBottom: 16 + theme.insets.bottom,
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },

    close: {
      position: 'absolute',
      top: theme.insets.top + 16,
      right: 16,
    },
  });

function useMeasureHeight() {
  const ref = useRef<View>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    ref.current?.measure((x, y, width, height, pageX, pageY) => {
      setHeight(height);
    });
  });

  return { ref, height };
}
