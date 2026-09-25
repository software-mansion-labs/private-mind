import {
  GRADIENT_ENTER_MS,
  GRADIENT_EXIT_MS,
  carriedGradientProgress,
  forgetGradientRuns,
  startGradientRun,
} from '../components/chat-screen/gradientHandoff';

const T0 = 1_000_000;

describe('gradient hand-off across chat screen remounts', () => {
  beforeEach(() => forgetGradientRuns());

  it('starts a cold app at the target, with nothing to animate from', () => {
    expect(carriedGradientProgress(1, T0)).toBe(1);
    expect(carriedGradientProgress(0, T0)).toBe(0);
  });

  it('hands a finished run over as its end value', () => {
    startGradientRun(1, T0);
    expect(carriedGradientProgress(0, T0 + GRADIENT_ENTER_MS)).toBe(1);
    expect(carriedGradientProgress(0, T0 + 60_000)).toBe(1);
  });

  it('lets a remount mid-fade pick up where the previous screen was', () => {
    startGradientRun(1, T0);
    startGradientRun(0, T0 + GRADIENT_ENTER_MS);
    const midway = carriedGradientProgress(
      1,
      T0 + GRADIENT_ENTER_MS + GRADIENT_EXIT_MS / 2
    );

    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(1);
  });

  it('arrives on the eased-out curve the screen animates with', () => {
    startGradientRun(0, T0 - 60_000);
    startGradientRun(1, T0);

    expect(carriedGradientProgress(0, T0 + GRADIENT_ENTER_MS / 4)).toBeCloseTo(
      1 - 0.75 ** 3,
      5
    );
    expect(
      carriedGradientProgress(0, T0 + (GRADIENT_ENTER_MS * 3) / 4)
    ).toBeCloseTo(1 - 0.25 ** 3, 5);
  });

  it('leaves faster than it arrives', () => {
    expect(GRADIENT_EXIT_MS).toBeLessThan(GRADIENT_ENTER_MS);
  });

  it('reverses from the current value rather than from the far end', () => {
    startGradientRun(0, T0 - 60_000);
    startGradientRun(1, T0);
    const atReversal = carriedGradientProgress(1, T0 + GRADIENT_ENTER_MS / 2);
    startGradientRun(0, T0 + GRADIENT_ENTER_MS / 2);

    expect(carriedGradientProgress(1, T0 + GRADIENT_ENTER_MS / 2)).toBeCloseTo(
      atReversal,
      5
    );
    expect(
      carriedGradientProgress(1, T0 + GRADIENT_ENTER_MS / 2 + GRADIENT_EXIT_MS)
    ).toBe(0);
  });

  it('never runs backwards in time', () => {
    startGradientRun(0, T0 - 60_000);
    startGradientRun(1, T0);
    expect(carriedGradientProgress(0, T0 - 10)).toBe(0);
  });

  it('does not animate the very first screen of a session', () => {
    startGradientRun(1, T0);
    expect(carriedGradientProgress(0, T0 + 1)).toBe(1);
  });
});
