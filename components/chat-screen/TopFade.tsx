import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { EdgeFade } from './EdgeFade';
import {
  FADE_GAP_TRIM,
  FADE_HEIGHT,
  SEAM_OVERLAP,
} from '../../constants/chat-screen';

export const topFadeHeight = (anchor: number) =>
  anchor - FADE_GAP_TRIM + FADE_HEIGHT;

interface Props {
  anchor: number;
  colors?: readonly [string, string];
  style?: StyleProp<ViewStyle>;
}

export const TopFade = React.memo(({ anchor, colors, style }: Props) => {
  const solidHeight = anchor - FADE_GAP_TRIM;
  const { styles } = useThemedStyles(createStyles, solidHeight);

  if (solidHeight <= 0) return null;

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      {colors ? (
        <LinearGradient colors={colors} style={styles.solid} />
      ) : (
        <View style={styles.solid} />
      )}
      <EdgeFade edge="top" color={colors?.[1]} style={styles.ramp} />
    </View>
  );
});

TopFade.displayName = 'TopFade';

const createStyles = (theme: Theme, solidHeight: number) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: solidHeight + FADE_HEIGHT,
    },
    solid: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: solidHeight + SEAM_OVERLAP,
      backgroundColor: theme.bg.softPrimary,
    },
    ramp: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: FADE_HEIGHT,
    },
  });
