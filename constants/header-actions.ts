export const HEADER_DIMMED_OPACITY = 0.4;

export const HEADER_DIM_IN_MS = 180;

export const HEADER_DIM_OUT_MS = 140;

export const TURN_IN_FLIGHT_HOLD_MS = 180;

export const dimOpacity = (progress: number) => {
  'worklet';
  return 1 - progress * (1 - HEADER_DIMMED_OPACITY);
};
