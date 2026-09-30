export const GRADIENT_ENTER_MS = 520;
export const GRADIENT_EXIT_MS = 320;

export const gradientRunMs = (to: number): number =>
  to === 1 ? GRADIENT_ENTER_MS : GRADIENT_EXIT_MS;

type GradientRun = {
  readonly from: number;
  readonly to: number;
  readonly startedAt: number;
};

let lastRun: GradientRun | null = null;

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

const easeInCubic = (t: number): number => t ** 3;

const progressOf = (run: GradientRun, now: number): number => {
  const elapsed = Math.min(
    1,
    Math.max(0, (now - run.startedAt) / gradientRunMs(run.to))
  );
  const ease = run.to === 1 ? easeOutCubic : easeInCubic;
  return run.from + (run.to - run.from) * ease(elapsed);
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
