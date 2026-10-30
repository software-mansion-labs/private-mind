import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme, withAlpha } from '../../styles/colors';
import { MASK_CLEAR, MASK_OPAQUE } from '../../constants/mask';

const BLUR_INTENSITY = 8;
const BLUR_REACH_BELOW_ANCHOR = 32;
const RAMP_HEIGHT = 72;
const TOP_ALPHA = 0.92;
const GRADIENT_STOPS = 10;

const smoothstep = (t: number) => t * t * (3 - 2 * t);

const easedStops = (from: number) =>
  Array.from({ length: GRADIENT_STOPS + 1 }, (_, i) => {
    const t = i / GRADIENT_STOPS;
    return { location: t, alpha: from * (1 - smoothstep(t)) };
  });

type Stops<T> = [T, T, ...T[]];

const GRADIENT_DIRECTION = {
  top: { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
  bottom: { start: { x: 0.5, y: 1 }, end: { x: 0.5, y: 0 } },
} as const;

interface Props {
  anchor: number;
  edge?: 'top' | 'bottom';
}

export const GlassScrollEdge = React.memo(({ anchor, edge = 'top' }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const direction = GRADIENT_DIRECTION[edge];
  const pinned = styles[edge];

  if (anchor <= 0) return null;

  const base = theme.bg.softPrimary;
  const dim = easedStops(TOP_ALPHA);
  const blurHeight = anchor + BLUR_REACH_BELOW_ANCHOR;
  const solidUntil = anchor / blurHeight;

  return (
    <View
      style={[styles.container, pinned, { height: anchor + RAMP_HEIGHT }]}
      pointerEvents="none"
    >
      {Platform.OS === 'ios' ? (
        <MaskedView
          style={[styles.blur, pinned, { height: blurHeight }]}
          maskElement={
            <LinearGradient
              colors={[MASK_OPAQUE, MASK_OPAQUE, MASK_CLEAR]}
              locations={[0, solidUntil, 1]}
              {...direction}
              style={StyleSheet.absoluteFill}
            />
          }
        >
          <BlurView
            tint="systemUltraThinMaterial"
            intensity={BLUR_INTENSITY}
            style={StyleSheet.absoluteFill}
          />
        </MaskedView>
      ) : null}
      <LinearGradient
        colors={dim.map(({ alpha }) => withAlpha(base, alpha)) as Stops<string>}
        locations={dim.map(({ location }) => location) as Stops<number>}
        {...direction}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});

GlassScrollEdge.displayName = 'GlassScrollEdge';

const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      left: 0,
      right: 0,
    },
    blur: {
      position: 'absolute',
      left: 0,
      right: 0,
    },
    top: {
      top: 0,
    },
    bottom: {
      bottom: 0,
    },
  });
