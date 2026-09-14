import React, { useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { withAlpha } from '../../styles/colors';

const LOCATIONS: [number, number, ...number[]] = [0, 0.25, 0.5, 0.75, 1];
const BOTTOM_ALPHAS = [0, 0.156, 0.5, 0.844, 1];
const TOP_ALPHAS = [...BOTTOM_ALPHAS].reverse();

interface Props {
  edge: 'top' | 'bottom';
  style?: StyleProp<ViewStyle>;
  color?: string;
}

export const EdgeFade = React.memo(({ edge, style, color }: Props) => {
  const { theme } = useTheme();
  const target = color ?? theme.bg.softPrimary;

  const colors = useMemo(() => {
    const ramp = edge === 'top' ? TOP_ALPHAS : BOTTOM_ALPHAS;
    return ramp.map((alpha) => withAlpha(target, alpha)) as [
      string,
      string,
      ...string[],
    ];
  }, [edge, target]);

  return (
    <LinearGradient
      colors={colors}
      locations={LOCATIONS}
      style={style}
      pointerEvents="none"
    />
  );
});

EdgeFade.displayName = 'EdgeFade';
