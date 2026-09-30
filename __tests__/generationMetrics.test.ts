import { calculatePerformanceMetrics } from '../utils/generationMetrics';

describe('calculatePerformanceMetrics', () => {
  it('reports decode speed over the window after the first token', () => {
    const { timeToFirstToken, tokensPerSecond } = calculatePerformanceMetrics(
      1000,
      11000,
      3000,
      160
    );

    expect(timeToFirstToken).toBe(2000);
    expect(tokensPerSecond).toBeCloseTo(20, 5);
  });

  it('ignores a first-token stamp left behind by an earlier generation', () => {
    const { tokensPerSecond } = calculatePerformanceMetrics(
      100000,
      112000,
      40000,
      5
    );

    expect(tokensPerSecond).toBe(0);
  });

  it('ignores a first-token stamp written by a generation that overlapped this one', () => {
    const { tokensPerSecond } = calculatePerformanceMetrics(
      1000,
      1600,
      9000,
      5
    );

    expect(tokensPerSecond).toBe(0);
  });

  it('reports nothing rather than a fabricated rate when no decode window was observed', () => {
    const { tokensPerSecond } = calculatePerformanceMetrics(
      1000,
      1000,
      1000,
      5
    );

    expect(tokensPerSecond).toBe(0);
  });
});
