interface GenerationMetrics {
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
): GenerationMetrics => {
  const totalTime = endTime - startTime;
  const timeToFirstToken = firstTokenBelongsToTurn(
    firstTokenTime,
    startTime,
    endTime
  )
    ? firstTokenTime - startTime
    : totalTime;
  const decodeTime = totalTime - timeToFirstToken;
  const tokensPerSecond =
    decodeTime > 0 && tokenCount > 0 ? tokenCount / (decodeTime / 1000) : 0;

  return { totalTime, timeToFirstToken, tokensPerSecond };
};
