export const RATE_WINDOW_FLOOR_MS = 20;

export const UNMEASURABLE_RATE = 0;

export interface PerformanceMetrics {
  totalTime: number;
  timeToFirstToken: number;
  tokensPerSecond: number;
}

export const calculatePerformanceMetrics = (
  startTime: number,
  endTime: number,
  firstTokenTime: number,
  tokenCount: number
): PerformanceMetrics => {
  const totalTime = endTime - startTime;
  const timeToFirstToken = firstTokenTime
    ? firstTokenTime - startTime
    : totalTime;
  const streamedWindow = totalTime - timeToFirstToken;
  const tokensAfterFirst = Math.max(0, tokenCount - 1);
  const measurable =
    tokensAfterFirst > 0 && streamedWindow >= RATE_WINDOW_FLOOR_MS;

  return {
    totalTime,
    timeToFirstToken,
    tokensPerSecond: measurable
      ? tokensAfterFirst / (streamedWindow / 1000)
      : UNMEASURABLE_RATE,
  };
};
