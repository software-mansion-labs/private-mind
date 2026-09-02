import type { ViewStyle } from 'react-native';
import { Easing } from 'react-native-reanimated';
import { mixColors, withAlpha, type Theme } from '../../../styles/colors';

// Geometry below is measured off the reference recording (1290×2796 @3x, a
// 430×932pt window) and divided down to points.

/**
 * The composer's own horizontal inset (ChatBar's `paddingHorizontal`). The
 * panel shares it, which is what keeps its left edge still through the morph.
 */
export const GUTTER = 16;

/**
 * Our composer, not the reference's. The + is a 36pt `CircleButton` in the
 * bottom row of a `padding: 16` card, where the reference has a 30pt hit target
 * in a 48pt row — so every anchor below is re-measured against ours.
 */
export const COMPOSER = {
  /** ChatBar container's padding above the bottom safe-area inset. */
  barPaddingBottom: 16,
  /** The input card's own padding. */
  cardPadding: 16,
  /** The + button — and so the diameter of the well the panel grows out of. */
  plusWell: 36,
  stripPaddingTop: 8,
  /** Gap between the strip and the text row — the card's own `gap`. */
  stripGap: 8,
  thumbSize: 72,
  thumbRadius: 8,
  thumbGap: 8,
  /** How far right the + glyph slides to clear the space the panel opens on. */
  plusSlide: 16,
} as const;

/** Window X of the + button's centre. */
export const PLUS_CENTER_X =
  GUTTER + COMPOSER.cardPadding + COMPOSER.plusWell / 2;

/** How far above the composer card's bottom edge the + button's centre sits. */
export const PLUS_CENTER_ABOVE_BOTTOM =
  COMPOSER.cardPadding + COMPOSER.plusWell / 2;

export const COMPOSER_STRIP_HEIGHT =
  COMPOSER.stripPaddingTop + COMPOSER.thumbSize + COMPOSER.stripGap;

export const MENU = {
  width: 280,
  itemHeight: 66,
  paddingVertical: 12,
  radius: 46,
  iconWell: 42,
  iconSize: 22,
  iconInset: 24,
  labelGap: 18,
  labelSize: 19,
  /** The menu's centre sits this far below the + button's centre. */
  centerOffset: 7,
} as const;

/** Camera / Photos / Files — the reference's Plugins and Think harder rows have
 *  no counterpart here. */
export const MENU_ITEMS = 3;
export const MENU_HEIGHT =
  MENU.itemHeight * MENU_ITEMS + MENU.paddingVertical * 2;

/**
 * The height the SHEET's top edge is anchored on — the reference's five-row
 * menu, not ours.
 *
 * The reference keeps one top edge for both shapes, which works because its
 * menu is 354pt tall. Ours is 222pt with three rows, and hanging the grid off
 * that line costs the sheet 66pt of height — the photo grid and the camera
 * come out visibly short. So the menu keeps its own centred top and the sheet
 * keeps the reference's; the morph moves the top edge between them.
 */
export const SHEET_ANCHOR_HEIGHT =
  MENU.itemHeight * 5 + MENU.paddingVertical * 2;

export const GRID = {
  columns: 3,
  /** Hairline of panel material showing between the cells. */
  gap: 1.5,
  cellRadius: 2,
  panelRadius: 52,
  badgeSize: 23,
  badgeRing: 2,
  badgeInset: 4,
  badgeLabelSize: 14,
} as const;

export const BOTTOM_BAR = {
  /** Inset from the sheet's own edge, the same on all three sides. */
  inset: 25,
  controlSize: 46,
  backIcon: 22,
  pillHeight: 43,
  pillPaddingHorizontal: 22,
  pillLabelSize: 17,
} as const;

export const CAMERA = {
  /** 68pt ring around a 60pt disc — 4pt of material showing all the way round. */
  shutterSize: 68,
  shutterPadding: 4,
  optionIcon: 22,
  optionGap: 10,
  /** Glass at zero size has nothing to refract, so options start here, not at 0. */
  optionStartScale: 0.35,
  quality: 0.85,
} as const;

export const EASE_FADE = Easing.out(Easing.quad);
export const EASE_OUT = Easing.out(Easing.poly(4));

export const SPRING = {
  panel: { duration: 400, dampingRatio: 0.8 },
  /** Every close. dampingRatio 1: overshoot would take the rect past the +. */
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
  /** How long the + glyph gets to itself before the panel mounts. */
  plusLead: 30,
} as const;

/** Panel contents are laid out at natural size, anchored top-left, and scaled
 *  by the panel. */
export const PANEL_CONTENT = {
  position: 'absolute',
  left: 0,
  top: 0,
  transformOrigin: 'top left',
} as const satisfies ViewStyle;

/**
 * Window Y of the sheet's top edge, given the composer's bottom. The panel, the
 * grid's layout and the flights all have to agree on this line.
 */
export function sheetTopFromComposerBottom(
  bottom: number,
  shapeHeight: number = SHEET_ANCHOR_HEIGHT
) {
  'worklet';
  return (
    bottom - PLUS_CENTER_ABOVE_BOTTOM + MENU.centerOffset - shapeHeight / 2
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

/**
 * The reference is a fixed dark surface; ours follows the app theme. Every
 * colour the panel uses is derived from a theme token here so light and dark
 * both land on the material the reference measured against black.
 */
export const panelPalette = (theme: Theme) => ({
  text: theme.text.primary,
  placeholder: theme.text.defaultTertiary,
  accent: theme.bg.main,
  /** The glass controls darken what they sit on. */
  controlScrim: withAlpha(theme.bg.softPrimary, 0.31),
  iconWell: withAlpha(theme.text.primary, 0.09),
  /** Laid over the panel's blur to land on the reference's material. */
  material: withAlpha(theme.text.primary, 0.047),
  /**
   * The same material where there is no blur to lay it over — Android hosts the
   * sheet in its own window, where a blur samples nothing. Dark resolves to
   * #1f1f1f, the reference's measured #1E1E1E.
   */
  materialFlat: mixColors(theme.bg.softPrimary, theme.text.primary, 0.12),
  /** Fill behind a photo for the frames before it decodes. */
  photoFill: mixColors(theme.bg.softPrimary, theme.text.primary, 0.08),
});

export type PanelPalette = ReturnType<typeof panelPalette>;
