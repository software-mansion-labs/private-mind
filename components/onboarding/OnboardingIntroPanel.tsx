import React, { useCallback, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme, mixColors } from '../../styles/colors';
import PrimaryButton from '../PrimaryButton';
import OnboardingScrim from './OnboardingScrim';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import {
  CARD_INSET,
  CONTENT_PADDING,
  ILLUSTRATION_CLEARANCE,
  ILLUSTRATION_SIDE_INSET,
  INTRO_ART,
  INTRO_ART_ASPECT_RATIO,
  INTRO_ART_MAX_WIDTH,
  INTRO_FADE_MS,
  INTRO_STAGGER_MS,
  TEXT_CONTROLS_GAP,
} from '../../constants/onboarding';

interface Props {
  onPressStart: () => void;
}

const enterAt = (step: number) =>
  FadeInDown.duration(INTRO_FADE_MS).delay(step * INTRO_STAGGER_MS);

function OnboardingIntroPanel({ onPressStart }: Props) {
  const { styles, theme } = useThemedStyles(createStyles);
  const { width, height } = useWindowDimensions();
  const [blockHeight, setBlockHeight] = useState(0);

  const handleBlockLayout = useCallback((event: LayoutChangeEvent) => {
    setBlockHeight(event.nativeEvent.layout.height);
  }, []);

  const blockTop = CARD_INSET + theme.insets.bottom + blockHeight;
  const zoneHeight = Math.max(height - blockTop - ILLUSTRATION_CLEARANCE, 0);
  const artHeight = Math.min(
    Math.min(width - ILLUSTRATION_SIDE_INSET * 2, INTRO_ART_MAX_WIDTH) /
      INTRO_ART_ASPECT_RATIO,
    zoneHeight
  );

  return (
    <View style={styles.root}>
      <View
        pointerEvents="none"
        style={[styles.artZone, { bottom: blockTop + ILLUSTRATION_CLEARANCE }]}
      >
        <INTRO_ART
          width={artHeight * INTRO_ART_ASPECT_RATIO}
          height={artHeight}
        />
      </View>

      <OnboardingScrim height={blockTop} />

      <View style={styles.block} onLayout={handleBlockLayout}>
        <View style={styles.headline}>
          <Animated.Text
            entering={enterAt(0)}
            style={[styles.line, styles.linePrimary]}
          >
            Your private AI mind.
          </Animated.Text>
          <Animated.Text
            entering={enterAt(1)}
            style={[styles.line, styles.lineAccent]}
          >
            In your pocket.
          </Animated.Text>
        </View>
        <Animated.View
          style={styles.action}
          entering={FadeInUp.duration(INTRO_FADE_MS).delay(
            2 * INTRO_STAGGER_MS
          )}
        >
          <PrimaryButton text="Get Started" onPress={onPressStart} />
        </Animated.View>
      </View>
    </View>
  );
}

export default OnboardingIntroPanel;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFillObject,
    },
    artZone: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    block: {
      position: 'absolute',
      left: CARD_INSET + CONTENT_PADDING,
      right: CARD_INSET + CONTENT_PADDING,
      bottom: CARD_INSET + theme.insets.bottom,
      alignItems: 'center',
      gap: TEXT_CONTROLS_GAP,
    },
    headline: {
      alignItems: 'center',
    },
    line: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xxl,
      lineHeight: lineHeights.xxl,
      textAlign: 'center',
    },
    linePrimary: {
      color: theme.text.onBrand,
    },
    lineAccent: {
      color: mixColors(theme.bg.main, theme.bg.onBrandStrong, 0.45),
    },
    action: {
      alignSelf: 'stretch',
    },
  });
