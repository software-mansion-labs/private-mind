import {
  looksLikePrimarySource,
  planFetchRecovery,
  promotePrimarySources,
  subjectOfQuery,
} from '../utils/web/fetchRecovery';
import type { FetchFailure } from '../utils/web/fetchFailure';
import type { WebSearchResult } from '../utils/web/types';
import { WEB_RECOVERY_MAX_QUERIES } from '../constants/web';

const failure = (
  host: string,
  reason: FetchFailure['reason']
): FetchFailure => ({ url: `https://${host}/page`, host, reason });

const result = (url: string): WebSearchResult => ({
  title: url,
  url,
  snippet: 'snippet',
});

describe('subjectOfQuery', () => {
  it('prefers a named entity over loose keywords', () => {
    expect(subjectOfQuery('ile kosztuje Samsung Galaxy S25 w Polsce')).toBe(
      'Samsung Galaxy S25'
    );
  });

  it('takes the longest entity when the query names more than one', () => {
    expect(subjectOfQuery('Nike Air Max vs New Balance')).toBe('Nike Air Max');
  });

  it('falls back to content words for the lowercase queries people actually type', () => {
    expect(subjectOfQuery('ile kosztuje iphone air')).toContain('iphone');
  });

  it('returns an empty subject when there is nothing to hold on to', () => {
    expect(subjectOfQuery('   ')).toBe('');
  });
});

describe('looksLikePrimarySource', () => {
  it('recognises a vendor domain that carries the subject name', () => {
    expect(looksLikePrimarySource('https://zalando.pl/x', 'Zalando buty')).toBe(
      true
    );
    expect(
      looksLikePrimarySource('https://shop.samsung.com/x', 'Samsung Galaxy S25')
    ).toBe(true);
  });

  it('does not mistake a random retailer for the primary source', () => {
    expect(
      looksLikePrimarySource('https://ceneo.pl/x', 'Samsung Galaxy S25')
    ).toBe(false);
  });

  it('is false without a subject to match against', () => {
    expect(looksLikePrimarySource('https://samsung.com/x', '')).toBe(false);
  });

  it('ignores tokens too short to be a meaningful domain match', () => {
    expect(looksLikePrimarySource('https://pl.example/x', 'pl')).toBe(false);
  });
});

describe('promotePrimarySources', () => {
  it('moves the subject’s own site to the front, keeping the rest in order', () => {
    const ranked = promotePrimarySources(
      [
        result('https://ceneo.pl/a'),
        result('https://mediaexpert.pl/b'),
        result('https://samsung.com/c'),
      ],
      'Samsung Galaxy S25'
    );
    expect(ranked.map((item) => item.url)).toEqual([
      'https://samsung.com/c',
      'https://ceneo.pl/a',
      'https://mediaexpert.pl/b',
    ]);
  });

  it('leaves the list untouched when nothing (or everything) is primary', () => {
    const results = [
      result('https://a.example/x'),
      result('https://b.example/y'),
    ];
    expect(promotePrimarySources(results, 'Samsung')).toBe(results);
    expect(promotePrimarySources(results, '')).toBe(results);
  });
});

describe('planFetchRecovery', () => {
  const base = {
    query: 'ile kosztuje Samsung Galaxy S25',
    triedQueries: ['ile kosztuje Samsung Galaxy S25'],
    needsMore: true,
  };

  it('does nothing when the retrieval was already good enough', () => {
    const plan = planFetchRecovery({
      ...base,
      failures: [failure('shop.example', 'blocked')],
      needsMore: false,
    });
    expect(plan.strategies).toEqual([]);
  });

  it('does nothing when no page actually failed', () => {
    expect(planFetchRecovery({ ...base, failures: [] }).strategies).toEqual([]);
  });

  it('ignores a cancelled search rather than treating it as a dead source', () => {
    const plan = planFetchRecovery({
      ...base,
      failures: [failure('shop.example', 'aborted')],
    });
    expect(plan.strategies).toEqual([]);
    expect(plan.deadHosts).toEqual([]);
  });

  it('searches the subject again away from the site that blocked us', () => {
    const plan = planFetchRecovery({
      ...base,
      failures: [failure('shop.example', 'blocked')],
    });
    expect(plan.deadHosts).toEqual(['shop.example']);
    expect(plan.strategies[0]).toEqual({
      kind: 'primary-source',
      query: 'Samsung Galaxy S25 -site:shop.example',
    });
  });

  it('excludes every dead host it has, up to the cap', () => {
    const plan = planFetchRecovery({
      ...base,
      failures: [
        failure('a.example', 'blocked'),
        failure('b.example', 'server-error'),
        failure('c.example', 'blocked'),
      ],
    });
    expect(plan.strategies[0]!.query).toBe(
      'Samsung Galaxy S25 -site:a.example -site:b.example'
    );
  });

  it('retries the same host for a page-level failure, where another page may work', () => {
    const plan = planFetchRecovery({
      ...base,
      failures: [failure('shop.example', 'not-found')],
    });
    expect(plan.deadHosts).toEqual([]);
    expect(plan.strategies).toContainEqual({
      kind: 'alternate-page',
      query: 'site:shop.example Samsung Galaxy S25',
      host: 'shop.example',
    });
  });

  it('does not retry a host that blocked the reader outright', () => {
    const plan = planFetchRecovery({
      ...base,
      failures: [failure('shop.example', 'blocked')],
    });
    expect(plan.strategies.some((s) => s.kind === 'alternate-page')).toBe(
      false
    );
  });

  it('gives up on a host that keeps failing the same way, whatever the reason', () => {
    const plan = planFetchRecovery({
      ...base,
      failures: [
        failure('olx.pl', 'too-large'),
        failure('olx.pl', 'too-large'),
      ],
    });
    expect(plan.deadHosts).toEqual(['olx.pl']);
    expect(plan.strategies.some((s) => s.host === 'olx.pl')).toBe(false);
    expect(plan.strategies[0]!.query).toBe('Samsung Galaxy S25 -site:olx.pl');
  });

  it('still gives a host one more chance after a single page-level miss', () => {
    const plan = planFetchRecovery({
      ...base,
      failures: [failure('olx.pl', 'too-large')],
    });
    expect(plan.deadHosts).toEqual([]);
    expect(plan.strategies).toContainEqual({
      kind: 'alternate-page',
      query: 'site:olx.pl Samsung Galaxy S25',
      host: 'olx.pl',
    });
  });

  it('never re-runs a query the search already tried', () => {
    const plan = planFetchRecovery({
      query: 'Samsung Galaxy S25',
      triedQueries: ['Samsung Galaxy S25', 'current Samsung Galaxy S25 price'],
      needsMore: true,
      intent: 'current Samsung Galaxy S25 price',
      failures: [failure('shop.example', 'timeout')],
    });
    const queries = plan.strategies.map((s) => s.query);
    expect(queries).not.toContain('Samsung Galaxy S25');
    expect(queries).not.toContain('current Samsung Galaxy S25 price');
  });

  it('prefers the page-level retry over restating when the host itself still works', () => {
    const plan = planFetchRecovery({
      query: 'Samsung Galaxy S25',
      triedQueries: ['Samsung Galaxy S25'],
      needsMore: true,
      intent: 'current Samsung Galaxy S25 price',
      failures: [failure('shop.example', 'timeout')],
    });
    expect(plan.strategies).toEqual([
      {
        kind: 'alternate-page',
        query: 'site:shop.example Samsung Galaxy S25',
        host: 'shop.example',
      },
    ]);
  });

  it('falls back to restating the planner’s intent when nothing else is left to try', () => {
    const plan = planFetchRecovery({
      query: 'Samsung Galaxy S25',
      triedQueries: [
        'Samsung Galaxy S25',
        'Samsung Galaxy S25 -site:shop.example',
      ],
      needsMore: true,
      intent: 'current Samsung Galaxy S25 price',
      failures: [failure('shop.example', 'blocked')],
    });
    expect(plan.strategies).toEqual([
      { kind: 'restate', query: 'current Samsung Galaxy S25 price' },
    ]);
  });

  it('spends at most one extra search, chosen by what actually failed', () => {
    const hostLevel = planFetchRecovery({
      ...base,
      failures: [
        failure('a.example', 'blocked'),
        failure('b.example', 'not-found'),
      ],
    });
    expect(hostLevel.strategies).toHaveLength(1);
    expect(hostLevel.strategies[0]!.kind).toBe('primary-source');

    const pageLevel = planFetchRecovery({
      ...base,
      failures: [
        failure('a.example', 'not-found'),
        failure('b.example', 'too-large'),
      ],
    });
    expect(pageLevel.strategies).toHaveLength(1);
    expect(pageLevel.strategies[0]!.kind).toBe('alternate-page');
  });

  it('caps how many extra searches a recovery may cost', () => {
    const plan = planFetchRecovery({
      ...base,
      intent: 'current Samsung Galaxy S25 price',
      failures: [
        failure('a.example', 'not-found'),
        failure('b.example', 'not-found'),
        failure('c.example', 'not-found'),
        failure('d.example', 'blocked'),
      ],
    });
    expect(plan.strategies.length).toBeLessThanOrEqual(
      WEB_RECOVERY_MAX_QUERIES
    );
  });
});
