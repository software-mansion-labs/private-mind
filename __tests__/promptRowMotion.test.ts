import {
  DRIFT_POINTS_PER_SECOND,
  driftStep,
  rowCopyCount,
  rowPositionFor,
  wrapRowOffset,
} from '../components/chat-screen/promptRowMotion';

describe('wrapping a row around its loop', () => {
  it('leaves the row in place until it has been measured', () => {
    expect(wrapRowOffset(16, 0)).toBe(16);
  });

  it('always keeps the track covering the screen from its left edge', () => {
    for (const offset of [-2500, -1000, -1, 0, 1, 999, 1000, 2500]) {
      const wrapped = wrapRowOffset(offset, 1000);
      expect(wrapped).toBeLessThan(0);
      expect(wrapped).toBeGreaterThanOrEqual(-1000);
    }
  });

  it('looks identical one full loop later, so the jump cannot be seen', () => {
    expect(wrapRowOffset(1250, 1000)).toBe(wrapRowOffset(250, 1000));
    expect(wrapRowOffset(-750, 1000)).toBe(wrapRowOffset(250, 1000));
  });
});

describe('the drift speed', () => {
  it('moves each row in its own direction', () => {
    expect(driftStep(-1, 1, 20)).toBe(-DRIFT_POINTS_PER_SECOND / 50);
    expect(driftStep(1, 1, 20)).toBe(DRIFT_POINTS_PER_SECOND / 50);
  });

  it('stands still while the row is held', () => {
    expect(Math.abs(driftStep(1, 0, 16))).toBe(0);
  });
});

describe('a row after a stalled frame', () => {
  it('carries on from where it was instead of lurching forward', () => {
    expect(driftStep(1, 1, 468)).toBe(driftStep(1, 1, 34));
  });
});

describe('a row across a chat switch', () => {
  it('keeps its place when the screen remounts', () => {
    const before = rowPositionFor(1, 16);
    before.offset.set(-300);

    const after = rowPositionFor(1, 16);

    expect(after.offset.get()).toBe(-300);
    expect(after.cycleWidth).toBe(before.cycleWidth);
  });

  it('keeps each row on its own position', () => {
    expect(rowPositionFor(-1, 16)).not.toBe(rowPositionFor(1, 16));
  });
});

describe('how many copies a row needs', () => {
  it('starts with two before it has been measured', () => {
    expect(rowCopyCount(402, 0)).toBe(2);
  });

  it('uses two when one loop is wider than the screen', () => {
    expect(rowCopyCount(402, 850)).toBe(2);
  });

  it('adds copies on a screen wider than one loop', () => {
    expect(rowCopyCount(1000, 400)).toBe(4);
  });
});
