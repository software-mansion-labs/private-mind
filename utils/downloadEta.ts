export interface RateSample {
  progress: number;
  at: number;
}

const RATE_SMOOTHING = 0.3;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

export const nextProgressRate = (
  previousRate: number | undefined,
  from: RateSample,
  to: RateSample
): number | undefined => {
  const elapsedMs = to.at - from.at;
  const gained = to.progress - from.progress;
  if (elapsedMs <= 0 || gained <= 0) {
    return previousRate;
  }
  const rate = gained / (elapsedMs / 1000);
  return previousRate === undefined
    ? rate
    : previousRate + RATE_SMOOTHING * (rate - previousRate);
};

export const secondsLeft = (progress: number, rate: number | undefined) =>
  rate && rate > 0 ? (1 - progress) / rate : undefined;

export const formatTimeLeft = (seconds: number) => {
  if (seconds < SECONDS_PER_MINUTE) return '< 1 min left';
  const minutes = Math.round(seconds / SECONDS_PER_MINUTE);
  if (minutes < MINUTES_PER_HOUR) return `~${minutes} min left`;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  return `~${hours} h ${minutes % MINUTES_PER_HOUR} min left`;
};
