import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import React, {
  ReactNode,
  useEffect,
  useState,
  type ComponentProps,
  type ComponentType,
} from 'react';
import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type AnimatedProps,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../../../context/ThemeContext';
import { isDarkTheme } from '../../../styles/colors';
import { panelPalette } from './constants';

const LIQUID_GLASS = isLiquidGlassAvailable();

type GlassSurfaceProps = ComponentProps<typeof GlassView> & {
  borderRadius?: number;
};
const GlassSurface = GlassView as ComponentType<GlassSurfaceProps>;

export type GlassStyleName = 'regular' | 'none';

function useGlassStyle(target: GlassStyleName, duration: number) {
  const [style, setStyle] = useState<GlassStyleName>('none');
  useEffect(() => setStyle(target), [target]);
  return { style, animate: true, animationDuration: duration };
}

function shapeOf(radius: number): ViewStyle {
  return { borderRadius: radius, borderCurve: 'continuous' };
}

export interface GlassProps extends ViewProps {
  fallbackTint?: string;
  radius?: number;
  active?: boolean;
  interactive?: boolean;
  scheme?: 'theme' | 'dark';
  fade?: SharedValue<number>;
  duration?: number;
  children?: ReactNode;
}

export function Glass({
  fallbackTint,
  radius = 0,
  active = true,
  interactive = true,
  duration = 0.25,
  scheme = 'theme',
  fade,
  style,
  children,
  ...rest
}: GlassProps) {
  const { theme } = useTheme();
  const dark = scheme === 'dark' || isDarkTheme(theme);
  const palette = panelPalette(theme);
  const glassEffectStyle = useGlassStyle(active ? 'regular' : 'none', duration);
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: fade ? fade.get() : 1,
  }));

  if (!LIQUID_GLASS) {
    return (
      <View style={[shapeOf(radius), styles.clip, style]} {...rest}>
        {active ? (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, scrimStyle]}
          >
            <BlurView
              intensity={60}
              tint={
                dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'
              }
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: fallbackTint ?? palette.controlScrim },
              ]}
            />
          </Animated.View>
        ) : null}
        {children}
      </View>
    );
  }

  return (
    <GlassSurface
      glassEffectStyle={glassEffectStyle}
      colorScheme={dark ? 'dark' : 'light'}
      tintColor={scheme === 'dark' ? palette.controlScrim : undefined}
      isInteractive={interactive}
      borderRadius={radius}
      style={[shapeOf(radius), style]}
      {...rest}
    >
      {children}
    </GlassSurface>
  );
}

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

const styles = StyleSheet.create({
  shape: {
    borderCurve: 'continuous',
  },
  clip: {
    overflow: 'hidden',
  },
});
