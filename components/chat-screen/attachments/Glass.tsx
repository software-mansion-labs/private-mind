import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import React, { ReactNode, useEffect, useState } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Animated, { type AnimatedProps } from 'react-native-reanimated';
import { useTheme } from '../../../context/ThemeContext';
import { isDarkTheme } from '../../../styles/colors';
import { panelPalette } from './constants';

/** True on iOS 26+, where `expo-glass-effect` renders the real material. */
const LIQUID_GLASS = isLiquidGlassAvailable();

/**
 * Whether a `BlurView` here actually samples what is behind it. On Android it
 * never does in this flow: the sheet is hosted over the keyboard in a window of
 * its own, so the blur finds nothing behind itself and comes out as the tint
 * alone. Those surfaces fall back to a flat fill.
 */
const BLURS_ITS_BACKDROP = Platform.OS !== 'android';

const AnimatedGlassView = Animated.createAnimatedComponent(GlassView);

export type GlassStyleName = 'regular' | 'none';

/**
 * A `GlassView` under an animated opacity renders nothing at all, even at 1.
 * It has a native transition for exactly this, so every glass surface here is
 * mounted at a fixed opacity and switched between styles instead.
 */
function useGlassStyle(target: GlassStyleName, duration: number) {
  const [style, setStyle] = useState<GlassStyleName>('none');
  useEffect(() => setStyle(target), [target]);
  return { style, animate: true, animationDuration: duration };
}

/** Shape without a clip: clipping stops interactive glass rendering the bulge
 *  it makes under a finger. */
function shapeOf(radius: number): ViewStyle {
  return { borderRadius: radius, borderCurve: 'continuous' };
}

export interface GlassProps extends ViewProps {
  /** Fill for the `expo-blur` stand-in only. */
  fallbackTint?: string;
  radius?: number;
  /** Whether the glass is showing. Transitions natively, never by opacity. */
  active?: boolean;
  /** False for a container, which should not bulge under a finger aiming at
   *  something inside it. */
  interactive?: boolean;
  /**
   * `theme` follows the app; `dark` pins the material dark whatever the theme
   * is. The floating controls take `dark`: they sit over photos, and their
   * glyphs are light in both themes.
   */
  scheme?: 'theme' | 'dark';
  /** Transition length in seconds. */
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
  style,
  children,
  ...rest
}: GlassProps) {
  const { theme } = useTheme();
  const dark = scheme === 'dark' || isDarkTheme(theme);
  const palette = panelPalette(theme);
  const glassEffectStyle = useGlassStyle(active ? 'regular' : 'none', duration);

  if (!LIQUID_GLASS) {
    return (
      <BlurView
        intensity={60}
        tint={dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
        // The fallback is a blur, and a blur does have to clip to its shape.
        style={[shapeOf(radius), styles.clip, style]}
        {...rest}
      >
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: fallbackTint ?? panelPalette(theme).controlScrim,
            },
          ]}
        />
        {children}
      </BlurView>
    );
  }

  return (
    <GlassView
      glassEffectStyle={glassEffectStyle}
      colorScheme={dark ? 'dark' : 'light'}
      isInteractive={interactive}
      style={[shapeOf(radius), style]}
      {...rest}
    >
      {/* The scrim is not only for the blur stand-in: real glass over a pale
          photo grid is pale too, and the light glyphs on these controls have to
          read against whatever the grid happens to be showing. A plain child
          with its own radius, never faded — the material itself must not go
          under an opacity. */}
      {scheme === 'dark' ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            shapeOf(radius),
            { backgroundColor: fallbackTint ?? palette.controlScrim },
          ]}
        />
      ) : null}
      {children}
    </GlassView>
  );
}

/**
 * The panel's own surface. `style` carries the panel's live corner radius: the
 * material rounds itself rather than being clipped, so it can still bulge under
 * a press. It stays in the touch path, which is also what stops a tap on the
 * menu's padding falling through to the dismiss backdrop behind it.
 */
export function PanelMaterial({
  variant,
  duration,
  style,
}: {
  variant: GlassStyleName;
  duration: number;
  /** Animated: the panel drives the material's corner radius through this. */
  style?: AnimatedProps<ViewProps>['style'];
}) {
  const { theme } = useTheme();
  const dark = isDarkTheme(theme);
  const palette = panelPalette(theme);
  const glassEffectStyle = useGlassStyle(variant, duration);

  if (!LIQUID_GLASS) {
    if (variant === 'none') return null;
    return (
      <Animated.View pointerEvents="none" style={[styles.clip, style]}>
        {BLURS_ITS_BACKDROP ? (
          <BlurView
            intensity={70}
            tint={
              dark
                ? 'systemUltraThinMaterialDark'
                : 'systemUltraThinMaterialLight'
            }
            style={StyleSheet.absoluteFill}
          >
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: palette.material },
              ]}
            />
          </BlurView>
        ) : (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: palette.materialFlat },
            ]}
          />
        )}
      </Animated.View>
    );
  }

  return (
    <AnimatedGlassView
      glassEffectStyle={glassEffectStyle}
      colorScheme={dark ? 'dark' : 'light'}
      isInteractive
      style={[styles.shape, style]}
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
