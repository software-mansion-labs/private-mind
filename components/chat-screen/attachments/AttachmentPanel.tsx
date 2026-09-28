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
  menuTopFromComposerBottom,
} from './constants';
import { PanelMaterial } from './Glass';

export interface PanelDrivers {
  open: SharedValue<number>;
  morph: SharedValue<number>;
  menuOpacity: SharedValue<number>;
  gridOpacity: SharedValue<number>;
  blur: SharedValue<number>;
  composerBottom: SharedValue<number>;
}

interface Props extends PanelDrivers {
  gridWidth: number;
  gridHeight: number;
  menuMaxBottom: number;
  sheetTop: number;
  sheetHeight: number;
  interactive: 'menu' | 'grid' | 'none';
  glass: boolean;
  menu: ReactNode;
  grid: ReactNode;
}

const AttachmentPanel = ({
  gridWidth,
  gridHeight,
  menuMaxBottom,
  sheetTop,
  sheetHeight,
  interactive,
  glass,
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

  const rect = useDerivedValue(() => {
    const bottom = composerBottom.get();
    const plusCenter = bottom - PLUS_CENTER_ABOVE_BOTTOM;

    const menuTop = Math.min(
      menuTopFromComposerBottom(bottom),
      menuMaxBottom - MENU_HEIGHT
    );

    const m = morph.get();
    let x = GUTTER;
    let y = mix(m, menuTop, sheetTop);
    let w = mix(m, MENU.width, gridWidth);
    let h = mix(m, MENU_HEIGHT, sheetHeight);
    let r = mix(m, MENU.radius, GRID.panelRadius);

    const o = open.get();
    const well = COMPOSER.plusWell;
    x = mix(o, PLUS_CENTER_X - well / 2, x);
    y = mix(o, plusCenter - well / 2, y);
    w = mix(o, well, w);
    h = mix(o, well, h);
    r = mix(o, well / 2, r);

    return { x, y, w, h, r };
  });

  const openFade = useDerivedValue(() =>
    interpolate(open.get(), [0.12, 0.6], [0, 1], Extrapolation.CLAMP)
  );

  const panelStyle = useAnimatedStyle(() => {
    const { x, y, w, h } = rect.get();
    return { left: x, top: y, width: w, height: h };
  });

  const radius = useDerivedValue(() => rect.get().r);
  const clipShape = useAnimatedStyle(() => ({ borderRadius: radius.get() }));

  const menuStyle = useAnimatedStyle(() => ({
    opacity:
      menuOpacity.get() *
      openFade.get() *
      interpolate(morph.get(), [0, 0.35], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: rect.get().w / MENU.width }],
  }));

  const gridStyle = useAnimatedStyle(() => ({
    opacity: gridOpacity.get() * openFade.get(),
    transform: [{ scale: rect.get().w / gridWidth }],
  }));

  const blurStyle = useAnimatedStyle(() => ({
    opacity: blur.get() * 0.85 * openFade.get(),
  }));

  return (
    <Animated.View
      testID="attachment-panel"
      pointerEvents="box-none"
      style={[styles.panel, panelStyle]}
    >
      <Animated.View
        pointerEvents="box-none"
        style={[StyleSheet.absoluteFill, styles.clip, clipShape]}
      >
        <PanelMaterial
          variant={glass ? 'regular' : 'none'}
          style={StyleSheet.absoluteFill}
        />

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
