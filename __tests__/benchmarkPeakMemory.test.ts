import {
  formatPeakMemory,
  UNMEASURED_PEAK_MEMORY_LABEL,
} from '../components/benchmark/BenchmarkStatsCard';

describe('formatPeakMemory', () => {
  it('reports a measured peak on any platform', () => {
    expect(formatPeakMemory(2.5)).toBe('2.50 GB');
  });

  it('says nothing was measured rather than reporting zero gigabytes', () => {
    expect(formatPeakMemory(0)).toBe(UNMEASURED_PEAK_MEMORY_LABEL);
  });

  it('treats a row saved before the metric existed as unmeasured', () => {
    expect(formatPeakMemory(-1)).toBe(UNMEASURED_PEAK_MEMORY_LABEL);
  });
});
