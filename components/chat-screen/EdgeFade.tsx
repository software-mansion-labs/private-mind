import React, { useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { withAlpha } from '../../styles/colors';

export const TOP_FADE_HEIGHT = 32;
export const BOTTOM_FADE_RUNUP = 24;
export const BOTTOM_FADE_SCALE = 0.5;

const LOCATIONS = [0, 0.25, 0.5, 0.75, 1] as const;
const ALPHAS = [0, 0.156, 0.5, 0.844, 1] as const;

interface Props {
  edge: 'top' | 'bottom';
  style?: StyleProp<ViewStyle>;
}

export const EdgeFade = React.memo(({ edge, style }: Props) => {
  const { theme } = useTheme();

  const colors = useMemo(() => {
    const ramp = edge === 'top' ? [...ALPHAS].reverse() : [...ALPHAS];
    return ramp.map((alpha) => withAlpha(theme.bg.softPrimary, alpha));
  }, [edge, theme.bg.softPrimary]);

  return (
    <LinearGradient
      colors={colors as [string, string, ...string[]]}
      locations={LOCATIONS as unknown as [number, number, ...number[]]}
      style={style}
      pointerEvents="none"
    />
  );
});

EdgeFade.displayName = 'EdgeFade';
