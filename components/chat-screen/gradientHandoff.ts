export const GRADIENT_FADE_MS = 900;

type GradientRun = {
  readonly from: number;
  readonly to: number;
  readonly startedAt: number;
};

let lastRun: GradientRun | null = null;

const easeInOutQuad = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);

const progressOf = (run: GradientRun, now: number): number => {
  const elapsed = Math.min(
    1,
    Math.max(0, (now - run.startedAt) / GRADIENT_FADE_MS)
  );
  return run.from + (run.to - run.from) * easeInOutQuad(elapsed);
};

export const carriedGradientProgress = (
  target: number,
  now: number = Date.now()
): number => (lastRun ? progressOf(lastRun, now) : target);

export const startGradientRun = (
  to: number,
  now: number = Date.now()
): void => {
  lastRun = { from: carriedGradientProgress(to, now), to, startedAt: now };
};

export const forgetGradientRuns = (): void => {
  lastRun = null;
};
