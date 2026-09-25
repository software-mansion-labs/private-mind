import {
  metricFor,
  sampleIntervalForMetric,
  PHYS_FOOTPRINT_METRIC,
  TOTAL_PSS_METRIC,
} from '../modules/memory-probe';

describe('which memory metric a platform reports', () => {
  it('prefers the native footprint probe wherever it exists', () => {
    expect(metricFor(true, 'ios')).toBe(PHYS_FOOTPRINT_METRIC);
  });

  it('reports total PSS on Android rather than nothing at all', () => {
    expect(metricFor(false, 'android')).toBe(TOTAL_PSS_METRIC);
  });

  it('reports nothing where neither reading is available', () => {
    expect(metricFor(false, 'web')).toBeNull();
  });

  it('never gives two platforms the same metric name', () => {
    expect(PHYS_FOOTPRINT_METRIC).not.toBe(TOTAL_PSS_METRIC);
  });
});

describe('how often a metric is sampled', () => {
  it('samples the cheap native probe more often than the expensive one', () => {
    expect(sampleIntervalForMetric(PHYS_FOOTPRINT_METRIC)).toBeLessThan(
      sampleIntervalForMetric(TOTAL_PSS_METRIC)
    );
  });
});
