import { getDefaultHeaderHeight } from 'expo-router/react-navigation';
import { bottomBarPadding } from './design-system';

export const DRAWER_EDGE_INSET = 56;
export const DRAWER_ENTRANCE_DRIFT_RATIO = 0.5;
export const DRAWER_ENTRANCE_SCALE = 0.8;

const PORTRAIT_LAYOUT = { width: 0, height: 1 };

export const DRAWER_SEARCH_BAR_HEIGHT = 44;

export const DRAWER_HORIZONTAL_PADDING = 16;

export const DRAWER_ITEM_INSET = 12;

export const DRAWER_FOOTER_EDGE_GAP =
  DRAWER_HORIZONTAL_PADDING + DRAWER_ITEM_INSET;

export const SEARCH_EXPAND_DURATION = 300;

export const SEARCH_FOCUS_DELAY = 200;

export const ANDROID_KEYBOARD_RESHOW_DELAY = 400;

export const SEARCH_COLLAPSE_DURATION = 240;

export const ICON_MORPH_DELAY = 60;

export const ICON_MORPH_DURATION = 240;

export const NAV_COLLAPSE_DURATION = 260;

export const SECTION_GAP = 20;

export const SEARCH_FOOTER_FADE_DURATION = 160;

export const DRAWER_CHAT_ROW_MIN_HEIGHT = 44;

export const DRAWER_FOOTER_BUTTON_HEIGHT = 44;

export const DRAWER_FOOTER_TOP_PADDING = 12;

export const NEW_CHAT_COLLAPSE_DURATION = 220;

export const getDrawerWidth = (screenWidth: number) =>
  Math.max(screenWidth - DRAWER_EDGE_INSET, 0);

const getScreenHeaderButtonCenter = (topInset: number) =>
  (topInset + getDefaultHeaderHeight(PORTRAIT_LAYOUT, false, topInset)) / 2;

export const getDrawerTopPadding = (topInset: number) =>
  getScreenHeaderButtonCenter(topInset) - DRAWER_SEARCH_BAR_HEIGHT / 2;

export const getDrawerFooterBottomPadding = bottomBarPadding;

export const getDrawerFooterHeight = (bottomInset: number) =>
  DRAWER_FOOTER_TOP_PADDING +
  DRAWER_FOOTER_BUTTON_HEIGHT +
  getDrawerFooterBottomPadding(bottomInset);

export const getDrawerHeaderHeight = (topInset: number) =>
  getDrawerTopPadding(topInset) + DRAWER_SEARCH_BAR_HEIGHT;
