import {
  RATE_WINDOW_FLOOR_MS,
  UNMEASURABLE_RATE,
  calculatePerformanceMetrics,
} from '../utils/performanceMetrics';

const metrics = (totalMs: number, firstTokenMs: number, tokenCount: number) => {
  const start = 1_000;
  return calculatePerformanceMetrics(
    start,
    start + totalMs,
    firstTokenMs === 0 ? 0 : start + firstTokenMs,
    tokenCount
  );
};

describe('the token rate a finished answer reports', () => {
  it('counts the tokens that arrived after the first one, over the time they took', () => {
    const { tokensPerSecond } = metrics(1_200, 200, 21);

    expect(tokensPerSecond).toBeCloseTo(20, 5);
  });

  it('reports nothing for an answer that ended in the first token', () => {
    expect(metrics(300, 290, 1).tokensPerSecond).toBe(UNMEASURABLE_RATE);
  });

  it('reports nothing when the whole answer landed inside the first token time', () => {
    expect(metrics(246, 246, 9).tokensPerSecond).toBe(UNMEASURABLE_RATE);
  });

  it('refuses a window too short to measure rather than inflating it', () => {
    const tooShort = metrics(500, 500 - (RATE_WINDOW_FLOOR_MS - 1), 9);
    const longEnough = metrics(500, 500 - RATE_WINDOW_FLOOR_MS, 9);

    expect(tooShort.tokensPerSecond).toBe(UNMEASURABLE_RATE);
    expect(longEnough.tokensPerSecond).toBeGreaterThan(0);
    expect(longEnough.tokensPerSecond).toBeLessThan(1_000);
  });

  it('never turns a short answer into thousands of tokens per second', () => {
    for (const tokenCount of [2, 5, 8, 9, 27]) {
      const { tokensPerSecond } = metrics(240, 239, tokenCount);
      expect(tokensPerSecond).toBeLessThan(1_000);
    }
  });

  it('keeps a long answer close to what it used to report', () => {
    const { tokensPerSecond } = metrics(10_000, 600, 300);

    expect(tokensPerSecond).toBeGreaterThan(30);
    expect(tokensPerSecond).toBeLessThan(33);
  });

  it('falls back to the whole run when no first token was timed', () => {
    const { timeToFirstToken, totalTime } = metrics(800, 0, 10);

    expect(timeToFirstToken).toBe(totalTime);
  });
});
