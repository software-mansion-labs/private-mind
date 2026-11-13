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
  mix,
  PANEL_CONTENT,
  PLUS_CENTER_ABOVE_BOTTOM,
  PLUS_CENTER_X,
  menuTopFromComposerBottom,
} from './constants';
import { PanelMaterial } from './PanelMaterial';

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
  menuHeight: number;
  sheetTop: number;
  sheetHeight: number;
  interactive: 'menu' | 'grid' | 'none';
  glass: boolean;
  menu: ReactNode;
  grid: ReactNode;
}

const OPEN_START_SCALE = COMPOSER.plusWell / MENU.width;

const AttachmentPanel = ({
  gridWidth,
  gridHeight,
  menuMaxBottom,
  menuHeight,
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

    const menuTop = Math.min(
      menuTopFromComposerBottom(bottom, menuHeight),
      menuMaxBottom - menuHeight
    );

    const m = morph.get();
    return {
      x: GUTTER,
      y: mix(m, menuTop, sheetTop),
      w: mix(m, MENU.width, gridWidth),
      h: mix(m, menuHeight, sheetHeight),
      r: mix(m, MENU.radius, GRID.panelRadius),
    };
  });

  const openFade = useDerivedValue(() =>
    interpolate(open.get(), [0, 0.4], [0, 1], Extrapolation.CLAMP)
  );

  const panelStyle = useAnimatedStyle(() => {
    const { x, y, w, h } = rect.get();
    return { left: x, top: y, width: w, height: h };
  });

  const clipShape = useAnimatedStyle(() => {
    const { x, y, r } = rect.get();
    const plusCenterY = composerBottom.get() - PLUS_CENTER_ABOVE_BOTTOM;
    return {
      borderRadius: r,
      opacity: openFade.get(),
      transformOrigin: [PLUS_CENTER_X - x, plusCenterY - y, 0],
      transform: [{ scale: mix(open.get(), OPEN_START_SCALE, 1) }],
    };
  });

  const menuStyle = useAnimatedStyle(() => ({
    opacity:
      menuOpacity.get() *
      interpolate(morph.get(), [0, 0.35], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: rect.get().w / MENU.width }],
  }));

  const gridStyle = useAnimatedStyle(() => ({
    opacity: gridOpacity.get(),
    transform: [{ scale: rect.get().w / gridWidth }],
  }));

  const blurStyle = useAnimatedStyle(() => ({
    opacity: blur.get() * 0.85,
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
            { width: MENU.width, height: menuHeight },
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
