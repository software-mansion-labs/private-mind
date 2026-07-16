import {
  reciprocalRankFusion,
  cosineSimilarity,
  termCoverage,
  maximalMarginalRelevance,
  adaptiveKeepCount,
} from '../utils/rankFusion';

describe('reciprocalRankFusion', () => {
  it('ranks an item that appears near the top of both lists above single-list items', () => {
    const scores = reciprocalRankFusion([
      { ids: ['a', 'b', 'c'] },
      { ids: ['b', 'd', 'a'] },
    ]);

    expect(scores.get('b')!).toBeGreaterThan(scores.get('c')!);
    expect(scores.get('a')!).toBeGreaterThan(scores.get('d')!);
  });

  it('sums contributions for an item present in multiple lists', () => {
    const k = 60;
    const scores = reciprocalRankFusion([{ ids: ['x'] }, { ids: ['x'] }], k);

    expect(scores.get('x')!).toBeCloseTo(2 / (k + 1));
  });

  it('respects per-list weights', () => {
    const scores = reciprocalRankFusion([
      { ids: ['a'], weight: 3 },
      { ids: ['b'], weight: 1 },
    ]);

    expect(scores.get('a')!).toBeGreaterThan(scores.get('b')!);
  });

  it('returns an empty map for no lists', () => {
    expect(reciprocalRankFusion([]).size).toBe(0);
  });
});

describe('cosineSimilarity', () => {
  it('is 1 for identical direction vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
  });

  it('is 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('is 0 when a vector is zero-length', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  it('is 0 for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });
});

describe('termCoverage', () => {
  it('returns the fraction of query terms present in the text', () => {
    const terms = new Set(['invoice', 'total', 'missing']);
    expect(termCoverage('the invoice total was paid', terms)).toBeCloseTo(
      2 / 3
    );
  });

  it('is case-insensitive', () => {
    expect(termCoverage('ERROR E4021 raised', new Set(['e4021']))).toBe(1);
  });

  it('returns 0 for no terms', () => {
    expect(termCoverage('anything', new Set())).toBe(0);
  });
});

describe('maximalMarginalRelevance', () => {
  const embed = (v: number[]) => v;

  it('picks the most relevant item first', () => {
    const selected = maximalMarginalRelevance(
      [
        { id: 'low', relevance: 0.2, embedding: embed([1, 0]) },
        { id: 'high', relevance: 0.9, embedding: embed([0, 1]) },
      ],
      1
    );

    expect(selected.map((s) => s.id)).toEqual(['high']);
  });

  it('prefers a diverse second pick over a near-duplicate of the first', () => {
    const selected = maximalMarginalRelevance(
      [
        { id: 'first', relevance: 1.0, embedding: embed([1, 0, 0]) },
        { id: 'duplicate', relevance: 0.95, embedding: embed([0.99, 0.01, 0]) },
        { id: 'diverse', relevance: 0.8, embedding: embed([0, 1, 0]) },
      ],
      2,
      0.7
    );

    expect(selected.map((s) => s.id)).toEqual(['first', 'diverse']);
  });

  it('never returns more than the requested count', () => {
    const selected = maximalMarginalRelevance(
      [
        { id: 'a', relevance: 1, embedding: [1, 0] },
        { id: 'b', relevance: 1, embedding: [0, 1] },
        { id: 'c', relevance: 1, embedding: [1, 1] },
      ],
      2
    );

    expect(selected).toHaveLength(2);
  });

  it('returns everything when count exceeds pool size', () => {
    const selected = maximalMarginalRelevance(
      [{ id: 'a', relevance: 1, embedding: [1, 0] }],
      5
    );

    expect(selected).toHaveLength(1);
  });

  it('caps selections per group, leaving slots for other groups', () => {
    const selected = maximalMarginalRelevance(
      [
        { id: 'a1', relevance: 1.0, embedding: [1, 0] },
        { id: 'a2', relevance: 0.9, embedding: [0, 1] },
        { id: 'a3', relevance: 0.8, embedding: [1, 1] },
        { id: 'b1', relevance: 0.3, embedding: [1, 0.5] },
      ],
      4,
      0.9,
      { groupOf: (c) => c.id[0], maxPerGroup: 2 }
    );

    const ids = selected.map((s) => s.id);
    expect(ids.filter((id) => id.startsWith('a'))).toHaveLength(2);
    expect(ids).toContain('b1');
  });

  it('stops instead of overfilling when every remaining item is in a full group', () => {
    const selected = maximalMarginalRelevance(
      [
        { id: 'a1', relevance: 1.0, embedding: [1, 0] },
        { id: 'a2', relevance: 0.9, embedding: [0, 1] },
        { id: 'a3', relevance: 0.8, embedding: [1, 1] },
      ],
      3,
      0.9,
      { groupOf: () => 'a', maxPerGroup: 2 }
    );

    expect(selected).toHaveLength(2);
  });
});

describe('adaptiveKeepCount', () => {
  it('keeps everything when scores decay gently', () => {
    expect(adaptiveKeepCount([1.0, 0.8, 0.6], 1, 0.45)).toBe(3);
  });

  it('cuts at the first large relative drop', () => {
    expect(adaptiveKeepCount([0.9, 0.85, 0.2], 1, 0.45)).toBe(2);
  });

  it('cuts to a single strong chunk when the rest fall off a cliff', () => {
    expect(adaptiveKeepCount([0.9, 0.1, 0.05], 1, 0.45)).toBe(1);
  });

  it('never trims below minKeep', () => {
    expect(adaptiveKeepCount([0.9, 0.1], 2, 0.45)).toBe(2);
  });

  it('never returns fewer than minKeep or more than the list', () => {
    expect(adaptiveKeepCount([0.9], 1, 0.45)).toBe(1);
    expect(adaptiveKeepCount([], 1, 0.45)).toBe(0);
  });
});
