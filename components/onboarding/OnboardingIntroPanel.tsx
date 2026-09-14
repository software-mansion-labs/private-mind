import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import PrimaryButton from '../PrimaryButton';
import TextLogo from '../../assets/text_logo.svg';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { INTRO_STAGGER_MS, SPILL_DURATION } from '../../constants/onboarding';

interface Props {
  onPressStart: () => void;
}

const enterAt = (step: number) =>
  FadeInDown.duration(SPILL_DURATION).delay(step * INTRO_STAGGER_MS);

function OnboardingIntroPanel({ onPressStart }: Props) {
  const { styles, theme } = useThemedStyles(createStyles);

  return (
    <View>
      <View style={styles.textContainer}>
        <Animated.View entering={enterAt(0)}>
          <TextLogo width={126} height={20} fill={theme.text.defaultTertiary} />
        </Animated.View>
        <Animated.Text
          entering={enterAt(1)}
          style={[styles.text, styles.line1]}
        >
          Your private AI mind.
        </Animated.Text>
        <Animated.Text
          entering={enterAt(2)}
          style={[styles.text, styles.line2]}
        >
          In your pocket.
        </Animated.Text>
      </View>
      <Animated.View
        entering={FadeInUp.duration(SPILL_DURATION).delay(3 * INTRO_STAGGER_MS)}
      >
        <PrimaryButton text="Get Started" onPress={onPressStart} />
      </Animated.View>
    </View>
  );
}

export default OnboardingIntroPanel;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    textContainer: {
      alignItems: 'center',
      marginBottom: 48,
    },
    text: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xxl,
      lineHeight: lineHeights.xxl,
    },
    line1: {
      marginTop: 20,
      color: theme.text.primary,
    },
    line2: {
      color: theme.bg.main,
    },
  });
