import { space, textStyles } from './design-system';

export const MAX_SHEET_HEIGHT_RATIO = 0.9;
export const SHEET_HANDLE_HEIGHT = 24;

const SHEET_CONTENT_PADDING_TOP = space.two;
const SHEET_CONTENT_PADDING_BOTTOM = space.eight;
const SHEET_TITLE_HEIGHT = textStyles.titleH3.lineHeight;
const SHEET_TITLE_GAP = space.three;

export const EST_ROW_HEIGHT = 50;
export const EST_ROW_GAP = space.two;
export const EST_SHEET_CHROME =
  SHEET_HANDLE_HEIGHT +
  SHEET_CONTENT_PADDING_TOP +
  SHEET_TITLE_HEIGHT +
  SHEET_TITLE_GAP +
  SHEET_CONTENT_PADDING_BOTTOM;

export const ROW_EXPAND_SCROLL_DELAY = 260;

export const SHEET_SPRING_CONFIG = {
  damping: 50,
  stiffness: 300,
  mass: 1,
  overshootClamping: true,
  restDisplacementThreshold: 0.5,
  restSpeedThreshold: 2,
};
