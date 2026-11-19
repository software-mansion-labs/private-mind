import React from 'react';
import { type ViewProps } from 'react-native';
import Animated, { type AnimatedProps } from 'react-native-reanimated';
import { useTheme } from '../../../context/ThemeContext';
import type { GlassStyleName } from '../../Glass';
import { panelPalette } from './constants';

export function PanelMaterial({
  variant,
  style,
}: {
  variant: GlassStyleName;
  style?: AnimatedProps<ViewProps>['style'];
}) {
  const { theme } = useTheme();
  const palette = panelPalette(theme);

  if (variant === 'none') return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[style, { backgroundColor: palette.materialFlat }]}
    />
  );
}
