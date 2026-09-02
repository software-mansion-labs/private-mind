import { BlurView } from 'expo-blur';
import React, { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../../../context/ThemeContext';
import { isDarkTheme } from '../../../styles/colors';
import {
  COMPOSER,
  GRID,
  GUTTER,
  MENU,
  MENU_HEIGHT,
  mix,
  PANEL_CONTENT,
  PLUS_CENTER_ABOVE_BOTTOM,
  PLUS_CENTER_X,
  sheetTopFromComposerBottom,
} from './constants';
import { PanelMaterial } from './Glass';

export interface PanelDrivers {
  /** 0 the circle around the + button → 1 the menu at rest. */
  open: SharedValue<number>;
  /** 0 menu-shaped → 1 full-bleed grid. */
  morph: SharedValue<number>;
  menuOpacity: SharedValue<number>;
  gridOpacity: SharedValue<number>;
  /** Opacity of the blur laid over the whole panel mid-transition. */
  blur: SharedValue<number>;
  /** Window Y of the composer's bottom edge, tracked live off the keyboard. */
  composerBottom: SharedValue<number>;
}

interface Props extends PanelDrivers {
  screenHeight: number;
  gridWidth: number;
  gridHeight: number;
  /** Which layer takes touches. Both stay mounted through the morph, and a
   *  faded-out view still swallows taps. */
  interactive: 'menu' | 'grid' | 'none';
  glass: boolean;
  /** How long the glass takes to come or go, in seconds. */
  glassDuration: number;
  menu: ReactNode;
  grid: ReactNode;
}

/**
 * The one surface behind the whole interaction: the menu and then the photo
 * grid, never two views handing off. Its contents are laid out at their own
 * natural size and scaled to fit, so the grid shrinks into the menu's footprint
 * and the menu blows up out of it.
 */
const AttachmentPanel = ({
  screenHeight,
  gridWidth,
  gridHeight,
  interactive,
  glass,
  glassDuration,
  menu,
  grid,
  open,
  morph,
  menuOpacity,
  gridOpacity,
  blur,
  composerBottom,
}: Props) => {
  const { theme } = useTheme();
  const dark = isDarkTheme(theme);

  /** The panel's frame, in window coordinates. Menu and grid share a top edge,
   *  so the morph only moves the left, right and bottom ones. */
  const rect = useDerivedValue(() => {
    const bottom = composerBottom.get();
    const plusCenter = bottom - PLUS_CENTER_ABOVE_BOTTOM;
    const top = sheetTopFromComposerBottom(bottom);

    const m = morph.get();
    let x = GUTTER;
    let y = top;
    let w = mix(m, MENU.width, gridWidth);
    let h = mix(m, MENU_HEIGHT, screenHeight - top - GUTTER);
    let r = mix(m, MENU.radius, GRID.panelRadius);

    // The panel begins as the circle wrapping the + button and grows out of it,
    // then collapses back into it. Nothing else ever draws that circle.
    const o = open.get();
    const well = COMPOSER.plusWell;
    x = mix(o, PLUS_CENTER_X - well / 2, x);
    y = mix(o, plusCenter - well / 2, y);
    w = mix(o, well, w);
    h = mix(o, well, h);
    r = mix(o, well / 2, r);

    return { x, y, w, h, r };
  });

  /**
   * The panel's own opacity is never animated: it carries the glass. Every
   * layer inside carries this fade instead. The ramp starts a beat late so the
   * circle reads as a circle before the rows arrive.
   */
  const openFade = useDerivedValue(() =>
    interpolate(open.get(), [0.12, 0.6], [0, 1], Extrapolation.CLAMP)
  );

  const panelStyle = useAnimatedStyle(() => {
    const { x, y, w, h } = rect.get();
    return { left: x, top: y, width: w, height: h };
  });

  /** The panel's live corner radius, worn by the material and by the clip. */
  const shapeStyle = useAnimatedStyle(() => ({ borderRadius: rect.get().r }));

  // Both wrappers carry their content's real size: a zero-sized wrapper would
  // still paint, but iOS drops touches that land outside a view's bounds.
  const menuStyle = useAnimatedStyle(() => ({
    opacity: menuOpacity.get() * openFade.get(),
    transform: [{ scale: rect.get().w / MENU.width }],
  }));

  const gridStyle = useAnimatedStyle(() => ({
    opacity: gridOpacity.get() * openFade.get(),
    transform: [{ scale: rect.get().w / gridWidth }],
  }));

  // Capped below 1: the tint that comes with a dark blur would otherwise read
  // as the panel dimming rather than softening.
  const blurStyle = useAnimatedStyle(() => ({
    opacity: blur.get() * 0.85 * openFade.get(),
  }));

  return (
    <Animated.View
      testID="attachment-panel"
      pointerEvents="box-none"
      style={[styles.panel, panelStyle]}
    >
      {/* The material, never wrapped in an animated opacity and never clipped —
          interactive glass draws its press bulge outside its own bounds. */}
      <PanelMaterial
        variant={glass ? 'regular' : 'none'}
        duration={glassDuration}
        style={[StyleSheet.absoluteFill, shapeStyle]}
      />

      {/* Everything that has to be cut to the panel's shape, and nothing else. */}
      <Animated.View
        pointerEvents="box-none"
        style={[StyleSheet.absoluteFill, styles.clip, shapeStyle]}
      >
        <Animated.View
          pointerEvents={interactive === 'grid' ? 'auto' : 'none'}
          style={[
            styles.content,
            { width: gridWidth, height: gridHeight },
            gridStyle,
          ]}
        >
          {grid}
        </Animated.View>

        <Animated.View
          pointerEvents={interactive === 'menu' ? 'auto' : 'none'}
          style={[
            styles.content,
            { width: MENU.width, height: MENU_HEIGHT },
            menuStyle,
          ]}
        >
          {menu}
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, blurStyle]}
        >
          <BlurView
            intensity={20}
            tint={dark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
};

export default AttachmentPanel;

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
  },
  clip: {
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  content: {
    ...PANEL_CONTENT,
  },
});
