import type { ViewStyle } from 'react-native';
import { Easing } from 'react-native-reanimated';
import { type Theme } from '../../../styles/colors';
import { radius } from '../../../constants/design-system';
import { MENU_ROW } from '../../menu/MenuRow';

export const GUTTER = 16;

export const COMPOSER = {
  barPaddingBottom: 16,
  cardPadding: 16,
  plusWell: 36,
  stripPaddingTop: 8,
  stripGap: 8,
  thumbSize: 72,
  thumbRadius: 8,
  thumbGap: 8,
  plusSlide: 16,
} as const;

export const PLUS_CENTER_X =
  GUTTER + COMPOSER.cardPadding + COMPOSER.plusWell / 2;

export const PLUS_CENTER_ABOVE_BOTTOM =
  COMPOSER.cardPadding + COMPOSER.plusWell / 2;

export const COMPOSER_STRIP_HEIGHT =
  COMPOSER.stripPaddingTop + COMPOSER.thumbSize + COMPOSER.stripGap;

export const MENU = {
  width: 280,
  itemHeight: MENU_ROW.regular.height,
  paddingVertical: 8,
  paddingHorizontal: 16,
  radius: radius.eighteen,
  centerOffset: 7,
} as const;

export const MENU_ITEMS = 3;
export const MENU_HEIGHT =
  MENU.itemHeight * MENU_ITEMS + MENU.paddingVertical * 2;

export const SHEET_TOP_GAP = 44;

export const CAMERA_ASPECT = 4 / 3;

export const GRID = {
  columns: 3,
  gap: 3,
  cellRadius: 2,
  panelRadius: radius.eighteen,
  badgeSize: 23,
  badgeRing: 2,
  badgeInset: 4,
  badgeLabelSize: 14,
} as const;

export const BOTTOM_BAR = {
  inset: 25,
  controlSize: 46,
  backIcon: 22,
  pillHeight: 43,
  pillPaddingHorizontal: 22,
  pillLabelSize: 17,
} as const;

export const CAMERA = {
  shutterSize: 68,
  shutterPadding: 4,
  optionIcon: 22,
  optionGap: 10,
  optionStartScale: 0.35,
  quality: 0.85,
} as const;

export const EASE_FADE = Easing.out(Easing.quad);
export const EASE_OUT = Easing.out(Easing.poly(4));

export const SPRING = {
  panel: { duration: 400, dampingRatio: 0.8 },
  panelOut: { duration: 400, dampingRatio: 1 },
  attach: { duration: 400 },
  strip: { duration: 400 },
  badge: { duration: 400 },
  pill: { duration: 400 },
} as const;

export const DURATION = {
  panel: SPRING.panel.duration,
  attach: 340,
  crossfade: 150,
  blur: 160,
  pill: 160,
  plusLead: 30,
} as const;

// The panel's position is animated on the UI thread, so React measures a row
// against the rect it had before the panel opened; without this every move
// event cancels the press.
export const PRESS_ANYWHERE = {
  top: 10000,
  bottom: 10000,
  left: 10000,
  right: 10000,
} as const;

export const PANEL_CONTENT = {
  position: 'absolute',
  left: 0,
  top: 0,
  transformOrigin: 'top left',
} as const satisfies ViewStyle;

export function menuTopFromComposerBottom(bottom: number) {
  'worklet';
  return (
    bottom - PLUS_CENTER_ABOVE_BOTTOM + MENU.centerOffset - MENU_HEIGHT / 2
  );
}

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function mix(t: number, a: number, b: number) {
  'worklet';
  return a + (b - a) * t;
}

export const panelPalette = (theme: Theme) => ({
  text: theme.text.primary,
  onControl: '#ffffff',
  placeholder: theme.text.defaultSecondary,
  accent: theme.bg.main,
  controlScrim: 'rgba(0, 0, 0, 0.18)',
  materialFlat: theme.bg.softPrimary,
  backdrop: 'rgba(0, 0, 0, 0.22)',
  photoFill: theme.bg.softSecondary,
});

export type PanelPalette = ReturnType<typeof panelPalette>;
