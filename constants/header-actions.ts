export const HEADER_DIMMED_OPACITY = 0.4;

export const HEADER_DIM_IN_MS = 180;

export const HEADER_DIM_OUT_MS = 140;

export const TURN_IN_FLIGHT_HOLD_MS = 180;

export const dimOpacity = (progress: number) => {
  'worklet';
  return 1 - progress * (1 - HEADER_DIMMED_OPACITY);
};

import { space } from './design-system';

export const GLASS_BUTTON_SIZE = 44;

export const TITLE_ICON_WIDTH = 10;

export const TITLE_ICON_HEIGHT = 12;

export const TITLE_LOCK_GAP = space.two;

export const TITLE_CAPSULE_PADDING = space.four;

export const HEADER_EDGE_PX = 16;
