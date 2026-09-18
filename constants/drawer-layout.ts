export const DRAWER_EDGE_INSET = 56;

export const DRAWER_TOP_SPACING = 12;

export const DRAWER_HORIZONTAL_PADDING = 16;

export const SEARCH_EXPAND_DURATION = 500;

export const SEARCH_COLLAPSE_DURATION = 240;

export const SEARCH_UNMOUNT_GRACE = 120;

export const BACKDROP_FADE_IN_DURATION = 240;

export const NAV_COLLAPSE_DURATION = 260;

export const FIELD_FADE_IN_DELAY = 90;

export const FIELD_FADE_IN_DURATION = 460;

export const FIELD_FADE_OUT_DURATION = 180;

export const SECTION_GAP = 24;

export const getDrawerWidth = (screenWidth: number) =>
  Math.max(screenWidth - DRAWER_EDGE_INSET, 0);

export const getDrawerTopPadding = (topInset: number) =>
  topInset + DRAWER_TOP_SPACING;
