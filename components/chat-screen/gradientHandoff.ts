export const GRADIENT_ENTER_MS = 520;
export const GRADIENT_EXIT_MS = 320;

type GradientRun = {
  readonly from: number;
  readonly to: number;
  readonly startedAt: number;
};

let lastRun: GradientRun | null = null;

const isArriving = (run: { from: number; to: number }) => run.to > run.from;

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

const easeInCubic = (t: number): number => t ** 3;

export const gradientDurationMs = (run: { from: number; to: number }) =>
  isArriving(run) ? GRADIENT_ENTER_MS : GRADIENT_EXIT_MS;

const progressOf = (run: GradientRun, now: number): number => {
  const elapsed = Math.min(
    1,
    Math.max(0, (now - run.startedAt) / gradientDurationMs(run))
  );
  const eased = isArriving(run) ? easeOutCubic(elapsed) : easeInCubic(elapsed);
  return run.from + (run.to - run.from) * eased;
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
