import {
  buildCorrectiveEvidence,
  parseCorrectiveQuery,
  reformulateForCorrection,
  reformulateWithEvidence,
  uncoveredTermsQuery,
} from '../utils/web/reformulateQuery';
import type { QueryRewriteMessage } from '../utils/web/buildSearchQuery';
import type { WebSearchResult } from '../utils/web/types';

describe('reformulateForCorrection', () => {
  it('prefers an unused planner sub-query', () => {
    const out = reformulateForCorrection(
      'coffee health effects',
      {
        intent: 'coffee vs tea',
        queries: ['coffee health effects', 'green tea health effects'],
      },
      ['coffee health effects']
    );
    expect(out).toBe('green tea health effects');
  });

  it('falls back to the planner intent when all sub-queries were run', () => {
    const out = reformulateForCorrection(
      'nvidia rtx 5090 launch date',
      { intent: 'rtx 5090 release', queries: ['nvidia rtx 5090 launch date'] },
      ['nvidia rtx 5090 launch date']
    );
    expect(out).toBe('rtx 5090 release');
  });

  it('broadens by dropping the trailing token when no plan alternative exists', () => {
    const out = reformulateForCorrection(
      'warsaw weather tomorrow',
      { intent: '', queries: ['warsaw weather tomorrow'] },
      ['warsaw weather tomorrow']
    );
    expect(out).toBe('warsaw weather');
  });

  it('returns empty when there is nothing meaningfully different to try', () => {
    const out = reformulateForCorrection(
      'bitcoin',
      { intent: '', queries: ['bitcoin'] },
      ['bitcoin']
    );
    expect(out).toBe('');
  });

  it('never returns the original or an already-run query', () => {
    const out = reformulateForCorrection(
      'a b c',
      { intent: 'a b c', queries: ['a b c'] },
      ['a b c', 'a b']
    );
    expect(out).toBe('');
  });

  it('is case-insensitive and whitespace-normalising for dedup', () => {
    const out = reformulateForCorrection(
      'Foo   Bar   Baz',
      { intent: 'Foo Bar', queries: ['Foo Bar Baz'] },
      ['foo bar baz']
    );
    expect(out).toBe('Foo Bar');
  });
});

describe('parseCorrectiveQuery', () => {
  it('reads the query out of a JSON field', () => {
    expect(parseCorrectiveQuery('{"query": "ISTAT Cagliari population"}')).toBe(
      'ISTAT Cagliari population'
    );
  });

  it('survives a leaked <think> block and surrounding prose', () => {
    const raw =
      '<think>the page mentions ISTAT so I should search there</think>\n' +
      'Here you go: {"query": "ISTAT Cagliari population"} hope that helps';
    expect(parseCorrectiveQuery(raw)).toBe('ISTAT Cagliari population');
  });

  it('treats an explicit empty query as "nothing better to try"', () => {
    expect(parseCorrectiveQuery('{"query": ""}')).toBe('');
  });

  it.each([
    ['no JSON at all', 'I think you should search for ISTAT instead.'],
    ['malformed JSON', '{"query": "unterminated'],
    ['wrong field type', '{"query": ["a", "b"]}'],
    ['missing field', '{"lead": "ISTAT"}'],
    ['empty output', ''],
  ])('returns empty on %s', (_label, raw) => {
    expect(parseCorrectiveQuery(raw)).toBe('');
  });

  it('rejects an over-long query rather than searching a sentence', () => {
    const long = 'word '.repeat(80).trim();
    expect(parseCorrectiveQuery(`{"query": "${long}"}`)).toBe('');
  });
});

describe('buildCorrectiveEvidence', () => {
  const page = (over: Partial<WebSearchResult> = {}): WebSearchResult => ({
    title: 'Portal',
    url: 'https://example.com/a',
    snippet: 'snippet text',
    ...over,
  });

  it('prefers extracted content over the snippet and caps its length', () => {
    const [item] = buildCorrectiveEvidence([
      page({ content: 'x'.repeat(5000) }),
    ]);
    expect(item!.host).toBe('example.com');
    expect(item!.excerpt.length).toBeLessThanOrEqual(400);
    expect(item!.excerpt.startsWith('x')).toBe(true);
  });

  it('falls back to the snippet when a page was never fetched', () => {
    const [item] = buildCorrectiveEvidence([page()]);
    expect(item!.excerpt).toBe('snippet text');
  });

  it('caps how many pages reach the prompt', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      page({ url: `https://e${i}.example/` })
    );
    expect(buildCorrectiveEvidence(many)).toHaveLength(3);
  });
});

describe('reformulateWithEvidence', () => {
  const evidence = [
    {
      host: 'citypop.example',
      title: 'Cagliari portal',
      excerpt: 'Figures are published by ISTAT, the statistics institute.',
    },
  ];
  const gen = (reply: string) => async () => reply;

  it('returns the lead the model found in the page text', async () => {
    const out = await reformulateWithEvidence({
      query: 'cagliari population',
      alreadyRun: ['cagliari population'],
      evidence,
      generate: gen('{"query": "ISTAT Cagliari population"}'),
    });
    expect(out).toBe('ISTAT Cagliari population');
  });

  it('passes the question, what was tried, and the excerpts to the model', async () => {
    let seen = '';
    await reformulateWithEvidence({
      query: 'cagliari population',
      alreadyRun: ['cagliari population 2026'],
      evidence,
      generate: async (messages: QueryRewriteMessage[]) => {
        seen = messages[messages.length - 1]!.content;
        return '{"query": ""}';
      },
    });
    expect(seen).toContain('cagliari population');
    expect(seen).toContain('cagliari population 2026');
    expect(seen).toContain('ISTAT');
    expect(seen).toContain('citypop.example');
  });

  it('rejects a query that just repeats one already searched', async () => {
    const out = await reformulateWithEvidence({
      query: 'cagliari population',
      alreadyRun: ['cagliari population 2026'],
      evidence,
      generate: gen('{"query": "Cagliari Population 2026"}'),
    });
    expect(out).toBe('');
  });

  it('returns empty when the model throws', async () => {
    const out = await reformulateWithEvidence({
      query: 'cagliari population',
      alreadyRun: [],
      evidence,
      generate: async () => {
        throw new Error('model unloaded');
      },
    });
    expect(out).toBe('');
  });

  it('does not call the model when round 1 left no evidence to read', async () => {
    const generate = jest.fn(async () => '{"query": "anything"}');
    const out = await reformulateWithEvidence({
      query: 'cagliari population',
      alreadyRun: [],
      evidence: [],
      generate,
    });
    expect(out).toBe('');
    expect(generate).not.toHaveBeenCalled();
  });
});

describe('uncoveredTermsQuery', () => {
  const page = (text: string): WebSearchResult => ({
    title: 'Result',
    url: 'https://example.test/a',
    snippet: '',
    content: text,
  });

  it('asks for the words the results never mentioned', () => {
    const out = uncoveredTermsQuery(
      'Aurora Tab battery capacity and Nimbus Dock price',
      [page('The Aurora Tab battery capacity is 7350 mAh.')],
      ['aurora tab battery capacity']
    );
    expect(out).toBe('nimbus dock price');
  });

  it('does not treat a word as covered because it sits inside a longer one', () => {
    const out = uncoveredTermsQuery(
      'best cat toy for kittens',
      [page('Popular vacation destinations for families with toys.')],
      []
    );
    expect(out.split(' ')).toContain('cat');
  });

  it('counts a term as covered when the page inflects it', () => {
    const out = uncoveredTermsQuery(
      'Kestrel Motors warranty and Solace Motors warranty',
      [page('Kestrel Motors warranties run for six years.')],
      []
    );
    expect(out).toBe('solace');
  });

  it('stays silent when nothing came back', () => {
    expect(uncoveredTermsQuery('anything at all here', [], [])).toBe('');
    expect(uncoveredTermsQuery('anything at all here', [page('')], [])).toBe(
      ''
    );
  });

  it('stays silent when the question has one searchable word', () => {
    expect(
      uncoveredTermsQuery('how is it', [page('Something else.')], [])
    ).toBe('');
  });

  it('stays silent when everything, or nothing, was covered', () => {
    const covered = uncoveredTermsQuery(
      'Aurora Tab battery',
      [page('Aurora Tab battery capacity is 7350 mAh.')],
      []
    );
    expect(covered).toBe('');
    const nothing = uncoveredTermsQuery(
      'Aurora Tab battery',
      [page('Completely unrelated prose about gardening.')],
      []
    );
    expect(nothing).toBe('');
  });

  it('stays silent for a question written without spaces', () => {
    expect(
      uncoveredTermsQuery(
        '故宫的占地面积是多少',
        [page('故宫简介与历史背景。')],
        []
      )
    ).toBe('');
  });

  it('never returns a query that was already run', () => {
    const out = uncoveredTermsQuery(
      'Aurora Tab battery and Nimbus Dock',
      [page('The Aurora Tab battery capacity is 7350 mAh.')],
      ['Nimbus Dock']
    );
    expect(out).toBe('');
  });
});
