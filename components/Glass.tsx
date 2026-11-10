import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import React, {
  ReactNode,
  useEffect,
  useState,
  type ComponentProps,
  type ComponentType,
} from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { isDarkTheme, type Theme } from '../styles/colors';

export const LIQUID_GLASS = isLiquidGlassAvailable();

const DARK_SCHEME_SCRIM = 'rgba(0, 0, 0, 0.18)';
const FALLBACK_BLUR_INTENSITY = 60;
const RAISED_SHADOW = {
  opacity: 0.1,
  radius: 10,
  offsetY: 3,
  elevation: 3,
};
const PAINTS_SOLID_FILL = Platform.OS === 'android';

type NativeGlassProps = ComponentProps<typeof GlassView> & {
  borderRadius?: number;
};
const NativeGlass = GlassView as ComponentType<NativeGlassProps>;

export type GlassStyleName = 'regular' | 'none';

function useGlassStyle(target: GlassStyleName, duration: number) {
  const [style, setStyle] = useState<GlassStyleName>('none');
  useEffect(() => setStyle(target), [target]);
  return { style, animate: true, animationDuration: duration };
}

function shapeOf(radius: number): ViewStyle {
  return { borderRadius: radius, borderCurve: 'continuous' };
}

function raisedEdge(theme: Theme): ViewStyle {
  return {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border.popover,
    shadowColor: theme.bg.shadow,
    shadowOffset: { width: 0, height: RAISED_SHADOW.offsetY },
    shadowOpacity: RAISED_SHADOW.opacity,
    shadowRadius: RAISED_SHADOW.radius,
    elevation: RAISED_SHADOW.elevation,
  };
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
  const schemeTint = scheme === 'dark' ? DARK_SCHEME_SCRIM : undefined;
  const glassEffectStyle = useGlassStyle(active ? 'regular' : 'none', duration);
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: fade ? fade.get() : 1,
  }));

  if (!LIQUID_GLASS) {
    const fill = fallbackTint ?? schemeTint ?? theme.bg.glassFallback;
    const solidFill = PAINTS_SOLID_FILL && !fade;
    return (
      <View
        style={[
          shapeOf(radius),
          solidFill && active && { backgroundColor: fill },
          solidFill && styles.clip,
          scheme === 'theme' && raisedEdge(theme),
          style,
        ]}
        {...rest}
      >
        {active && !solidFill ? (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              shapeOf(radius),
              styles.clip,
              scrimStyle,
            ]}
          >
            <BlurView
              intensity={FALLBACK_BLUR_INTENSITY}
              tint={
                dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'
              }
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: fill }]}
            />
          </Animated.View>
        ) : null}
        {children}
      </View>
    );
  }

  return (
    <NativeGlass
      glassEffectStyle={glassEffectStyle}
      colorScheme={dark ? 'dark' : 'light'}
      tintColor={schemeTint}
      isInteractive={interactive}
      borderRadius={radius}
      style={[shapeOf(radius), style]}
      {...rest}
    >
      {children}
    </NativeGlass>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
});
