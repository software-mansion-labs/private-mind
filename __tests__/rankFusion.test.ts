import {
  reciprocalRankFusion,
  cosineSimilarity,
  termCoverage,
  maximalMarginalRelevance,
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
});
