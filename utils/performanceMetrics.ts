export const RATE_WINDOW_FLOOR_MS = 20;

export const UNMEASURABLE_RATE = 0;

export interface PerformanceMetrics {
  totalTime: number;
  timeToFirstToken: number;
  tokensPerSecond: number;
}

const firstTokenBelongsToTurn = (
  firstTokenTime: number,
  startTime: number,
  endTime: number
) => firstTokenTime >= startTime && firstTokenTime <= endTime;

export const calculatePerformanceMetrics = (
  startTime: number,
  endTime: number,
  firstTokenTime: number,
  tokenCount: number
): PerformanceMetrics => {
  const totalTime = endTime - startTime;
  const timeToFirstToken = firstTokenBelongsToTurn(
    firstTokenTime,
    startTime,
    endTime
  )
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
