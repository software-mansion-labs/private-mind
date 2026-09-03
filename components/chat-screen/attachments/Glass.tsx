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

/** True on iOS 26+, where `expo-glass-effect` renders the real material. */
const LIQUID_GLASS = isLiquidGlassAvailable();

/**
 * `borderRadius` is a native prop of the glass view, missing from the package's
 * prop types. Passed anyway: on the small controls it is the difference between
 * a circle and the effect's own fixed corner.
 */
type GlassSurfaceProps = ComponentProps<typeof GlassView> & {
  borderRadius?: number;
};
const GlassSurface = GlassView as ComponentType<GlassSurfaceProps>;

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

/**
 * Shape without a clip: clipping stops interactive glass rendering the bulge it
 * makes under a finger.
 *
 * A `GlassView` takes its corner from the `borderRadius` **prop**, never from
 * the style — `expo-glass-effect` feeds the prop to the effect's own
 * `cornerConfiguration` and leaves the style to the container. So every glass
 * surface here passes the radius both ways: as a style for the stand-in, and as
 * a prop for the material.
 */
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
   * glyphs are light in both themes — which needs the material to be dark
   * whatever is behind it, not merely dark-schemed. Liquid glass is clear
   * enough that over a white screenshot an untinted control and its white
   * glyphs both disappear.
   */
  scheme?: 'theme' | 'dark';
  /**
   * Fades the blur stand-in's tint with the surface it belongs to. The glass
   * itself must never go under an animated opacity, but a child drawn inside it
   * may — and without this the tint sits on screen while the menu is up and
   * long after the sheet has gone.
   */
  fade?: SharedValue<number>;
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
      // The stand-in has to answer to `active` the way real glass does. A
      // GlassView switches its material to 'none' and keeps its children; a
      // BlurView has no such switch, and on Android — where it sits in the
      // over-keyboard window with nothing to sample — it renders as a solid
      // tinted rectangle. Left up while the menu is showing, that is a visible
      // slab behind controls that are supposed to be gone.
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

/**
 * The panel's own surface: a plain fill, cut by the panel's own clip like
 * everything else inside it.
 *
 * Deliberately neither glass nor blur. Both are a `UIVisualEffectView`, and on
 * iOS one of those keeps a corner of its own — measured at ~20pt on the
 * iPhone 17 simulator — that answers to nothing: not its own `borderRadius`,
 * animated or static, not `expo-glass-effect`'s `borderRadius` prop, and not an
 * ancestor's rounded `overflow: hidden`. Under a sheet rounded to 52 it stood
 * out past the photos at every corner, which is the light border seen around
 * the grid and around the camera. Proved by painting this surface red: the
 * corners went red while the cells stayed inside their 52pt curve.
 *
 * It still must not be wrapped in an animated opacity: it is taken out of the
 * tree by `variant` rather than made transparent.
 */
export function PanelMaterial({
  variant,
  style,
}: {
  variant: GlassStyleName;
  /** Animated: the panel's frame. The shape comes from the panel's clip. */
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
