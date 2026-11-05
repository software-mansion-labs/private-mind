export type DriftDirection = -1 | 1;

export const DRIFT_POINTS_PER_SECOND = 25;
export const DRIFT_RESUME_MS = 400;
export const ROW_DRAG_SLOP = 8;
const MINIMUM_ROW_COPIES = 2;

export const wrapRowOffset = (offset: number, cycleWidth: number): number => {
  'worklet';
  if (cycleWidth <= 0) return offset;
  return (((offset % cycleWidth) + cycleWidth) % cycleWidth) - cycleWidth;
};

export const driftStep = (
  direction: DriftDirection,
  driftShare: number,
  elapsedMs: number
): number => {
  'worklet';
  return (direction * DRIFT_POINTS_PER_SECOND * driftShare * elapsedMs) / 1000;
};

export const rowCopyCount = (
  viewportWidth: number,
  cycleWidth: number
): number =>
  cycleWidth <= 0
    ? MINIMUM_ROW_COPIES
    : Math.max(MINIMUM_ROW_COPIES, Math.ceil(viewportWidth / cycleWidth) + 1);
