import {
  formatTimeLeft,
  nextProgressRate,
  secondsLeft,
} from '../utils/downloadEta';

describe('nextProgressRate', () => {
  it('takes the first measured rate as is', () => {
    expect(
      nextProgressRate(
        undefined,
        { progress: 0.1, at: 0 },
        { progress: 0.2, at: 10_000 }
      )
    ).toBeCloseTo(0.01);
  });

  it('moves part of the way toward a new rate instead of jumping to it', () => {
    const rate = nextProgressRate(
      0.01,
      { progress: 0.2, at: 0 },
      { progress: 0.4, at: 10_000 }
    );
    expect(rate).toBeGreaterThan(0.01);
    expect(rate).toBeLessThan(0.02);
  });

  it('measures slow downloads that take minutes per percent', () => {
    expect(
      nextProgressRate(
        undefined,
        { progress: 0, at: 0 },
        { progress: 0.01, at: 150_000 }
      )
    ).toBeCloseTo(0.01 / 150);
  });

  it('keeps the previous rate when progress did not advance', () => {
    expect(
      nextProgressRate(
        0.01,
        { progress: 0.2, at: 0 },
        { progress: 0.2, at: 1_000 }
      )
    ).toBe(0.01);
  });
});

describe('secondsLeft', () => {
  it('is unknown until a rate has been measured', () => {
    expect(secondsLeft(0.5, undefined)).toBeUndefined();
  });

  it('divides the remaining fraction by the rate', () => {
    expect(secondsLeft(0.5, 0.01)).toBeCloseTo(50);
  });
});

describe('formatTimeLeft', () => {
  it.each([
    [30, '< 1 min left'],
    [150, '~3 min left'],
    [59 * 60, '~59 min left'],
    [95 * 60, '~1 h 35 min left'],
  ])('formats %d seconds as "%s"', (seconds, label) => {
    expect(formatTimeLeft(seconds)).toBe(label);
  });
});
