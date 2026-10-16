import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme, withAlpha } from '../../styles/colors';

const BLUR_INTENSITY = 8;
const BLUR_REACH_BELOW_ANCHOR = 32;
const RAMP_HEIGHT = 72;
const TOP_ALPHA = 0.92;
const GRADIENT_STOPS = 10;
const MASK_OPAQUE = '#000000';
const MASK_CLEAR = 'rgba(0, 0, 0, 0)';

const smoothstep = (t: number) => t * t * (3 - 2 * t);

const easedStops = (from: number) =>
  Array.from({ length: GRADIENT_STOPS + 1 }, (_, i) => {
    const t = i / GRADIENT_STOPS;
    return { location: t, alpha: from * (1 - smoothstep(t)) };
  });

type Stops<T> = [T, T, ...T[]];

interface Props {
  anchor: number;
}

export const GlassScrollEdge = React.memo(({ anchor }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);

  if (anchor <= 0) return null;

  const base = theme.bg.softPrimary;
  const dim = easedStops(TOP_ALPHA);
  const blurHeight = anchor + BLUR_REACH_BELOW_ANCHOR;
  const solidUntil = anchor / blurHeight;

  return (
    <View
      style={[styles.container, { height: anchor + RAMP_HEIGHT }]}
      pointerEvents="none"
    >
      {Platform.OS === 'ios' ? (
        <MaskedView
          style={[styles.blur, { height: blurHeight }]}
          maskElement={
            <LinearGradient
              colors={[MASK_OPAQUE, MASK_OPAQUE, MASK_CLEAR]}
              locations={[0, solidUntil, 1]}
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
      top: 0,
      left: 0,
      right: 0,
    },
    blur: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
    },
  });
