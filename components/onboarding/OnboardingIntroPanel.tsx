import React, { useCallback, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
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
  WIDE_INTRO_ART_MAX_WIDTH,
} from '../../constants/onboarding';
import { useOnboardingLayout } from '../../hooks/useOnboardingLayout';

interface Props {
  onPressStart: () => void;
}

const enterAt = (step: number) =>
  FadeInDown.duration(INTRO_FADE_MS).delay(step * INTRO_STAGGER_MS);

function OnboardingIntroPanel({ onPressStart }: Props) {
  const { styles, theme } = useThemedStyles(createStyles);
  const {
    screenWidth: width,
    screenHeight: height,
    isWide,
    isSplit,
    panelWidth,
    columnLeft,
    columnRight,
  } = useOnboardingLayout();
  const [blockHeight, setBlockHeight] = useState(0);

  const handleBlockLayout = useCallback((event: LayoutChangeEvent) => {
    setBlockHeight(event.nativeEvent.layout.height);
  }, []);

  const artMaxWidth = isWide ? WIDE_INTRO_ART_MAX_WIDTH : INTRO_ART_MAX_WIDTH;
  const edgeClearance = CARD_INSET + theme.insets.bottom;
  const blockTop = edgeClearance + blockHeight;
  const artAreaWidth = isSplit ? width - panelWidth : width;
  const artZoneBottom = isSplit
    ? edgeClearance
    : blockTop + ILLUSTRATION_CLEARANCE;
  const zoneHeight = Math.max(
    height - artZoneBottom - (isSplit ? theme.insets.top + CARD_INSET : 0),
    0
  );
  const artHeight = Math.min(
    Math.min(artAreaWidth - ILLUSTRATION_SIDE_INSET * 2, artMaxWidth) /
      INTRO_ART_ASPECT_RATIO,
    zoneHeight
  );
  const blockBottom = isSplit
    ? Math.max((height - blockHeight) / 2, edgeClearance)
    : edgeClearance;

  return (
    <View style={styles.root}>
      <View
        pointerEvents="none"
        style={[
          styles.artZone,
          { bottom: artZoneBottom },
          isSplit && { right: panelWidth },
        ]}
      >
        <INTRO_ART
          width={artHeight * INTRO_ART_ASPECT_RATIO}
          height={artHeight}
        />
      </View>

      {isSplit ? (
        <View
          pointerEvents="none"
          style={[styles.splitPanel, { width: panelWidth }]}
        />
      ) : (
        <OnboardingScrim height={blockTop} />
      )}

      <View
        style={[
          styles.block,
          isSplit && styles.leading,
          {
            bottom: blockBottom,
            left: columnLeft + CONTENT_PADDING,
            right: columnRight + CONTENT_PADDING,
          },
        ]}
        onLayout={handleBlockLayout}
      >
        <View style={[styles.headline, isSplit && styles.leading]}>
          <Animated.Text
            entering={enterAt(0)}
            style={[
              styles.line,
              styles.linePrimary,
              isSplit && styles.lineLeading,
            ]}
          >
            Your private AI mind.
          </Animated.Text>
          <Animated.Text
            entering={enterAt(1)}
            style={[
              styles.line,
              styles.lineAccent,
              isSplit && styles.lineLeading,
            ]}
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
      ...StyleSheet.absoluteFill,
    },
    artZone: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    splitPanel: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.bg.onBrandShadow,
    },
    block: {
      position: 'absolute',
      alignItems: 'center',
      gap: TEXT_CONTROLS_GAP,
    },
    leading: {
      alignItems: 'flex-start',
    },
    lineLeading: {
      textAlign: 'left',
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
