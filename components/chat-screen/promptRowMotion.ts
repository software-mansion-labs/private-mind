import { makeMutable, type SharedValue } from 'react-native-reanimated';

export type DriftDirection = -1 | 1;

export const DRIFT_POINTS_PER_SECOND = 25;
export const DRIFT_RESUME_MS = 400;
export const DRIFT_SETTLE_MS = 150;
export const ROW_DRAG_SLOP = 8;
const MINIMUM_ROW_COPIES = 2;
const LONGEST_DRIFT_STEP_MS = 34;

export interface RowPosition {
  offset: SharedValue<number>;
  cycleWidth: SharedValue<number>;
}

const rowPositions = new Map<DriftDirection, RowPosition>();

export const rowPositionFor = (
  direction: DriftDirection,
  initialOffset: number
): RowPosition => {
  let position = rowPositions.get(direction);
  if (!position) {
    position = {
      offset: makeMutable(initialOffset),
      cycleWidth: makeMutable(0),
    };
    rowPositions.set(direction, position);
  }
  return position;
};

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
  const stepMs = Math.min(elapsedMs, LONGEST_DRIFT_STEP_MS);
  return (direction * DRIFT_POINTS_PER_SECOND * driftShare * stepMs) / 1000;
};

export const rowCopyCount = (
  viewportWidth: number,
  cycleWidth: number
): number =>
  cycleWidth <= 0
    ? MINIMUM_ROW_COPIES
    : Math.max(MINIMUM_ROW_COPIES, Math.ceil(viewportWidth / cycleWidth) + 1);
