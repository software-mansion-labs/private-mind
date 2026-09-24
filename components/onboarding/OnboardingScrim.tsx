import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { EdgeFade } from '../chat-screen/EdgeFade';
import { Theme } from '../../styles/colors';
import { SCRIM_RISE } from '../../constants/onboarding';

interface Props {
  height: number;
}

function OnboardingScrim({ height }: Props) {
  const { styles, theme } = useThemedStyles(createStyles);

  return (
    <>
      <View pointerEvents="none" style={[styles.solid, { height }]} />
      <EdgeFade
        edge="bottom"
        color={theme.bg.onBrandShadow}
        style={[styles.fade, { bottom: height }]}
      />
    </>
  );
}

export default OnboardingScrim;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    solid: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.bg.onBrandShadow,
    },
    fade: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: SCRIM_RISE,
    },
  });
