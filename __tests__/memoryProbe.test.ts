import {
  metricFor,
  sampleIntervalForMetric,
  strainedSince,
  MEMORY_STRAIN_GRACE_MS,
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

describe('whether iOS reported memory pressure around a turn', () => {
  const turnStart = 1_000_000;

  it('is strained while the system still reports warning or critical pressure', () => {
    expect(
      strainedSince({ level: 'warning', lastStrainAt: 0 }, turnStart)
    ).toBe(true);
    expect(
      strainedSince({ level: 'critical', lastStrainAt: 0 }, turnStart)
    ).toBe(true);
  });

  it('counts pressure that eased just before the turn started', () => {
    const justBefore = turnStart - MEMORY_STRAIN_GRACE_MS;
    expect(
      strainedSince({ level: 'normal', lastStrainAt: justBefore }, turnStart)
    ).toBe(true);
  });

  it('is not strained when the last pressure event is older than the grace period', () => {
    const longAgo = turnStart - MEMORY_STRAIN_GRACE_MS - 1;
    expect(
      strainedSince({ level: 'normal', lastStrainAt: longAgo }, turnStart)
    ).toBe(false);
    expect(
      strainedSince({ level: 'normal', lastStrainAt: -1 }, turnStart)
    ).toBe(false);
  });

  it('is never strained where the probe does not exist', () => {
    expect(strainedSince(null, turnStart)).toBe(false);
    expect(strainedSince(undefined, turnStart)).toBe(false);
  });
});
