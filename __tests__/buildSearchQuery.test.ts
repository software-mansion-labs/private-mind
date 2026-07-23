import {
  isConciseQuery,
  parseSearchPlan,
  planWebSearch,
  sanitizeSearchQuery,
} from '../utils/web/buildSearchQuery';

const history = [
  { role: 'user', content: 'I feel tired, does coffee help or make it worse?' },
  { role: 'assistant', content: 'Coffee can worsen fatigue over time…' },
];

const TODAY = '2026-07-17';

describe('isConciseQuery', () => {
  it('accepts short, self-contained keyword queries', () => {
    expect(isConciseQuery('current bitcoin price usd')).toBe(true);
    expect(isConciseQuery('warsaw weather forecast')).toBe(true);
    expect(isConciseQuery('best pizza in kraków')).toBe(true);
  });

  it('rejects questions, follow-ups, anaphora, and long messages', () => {
    expect(isConciseQuery('how much of it should I drink?')).toBe(false);
    expect(isConciseQuery('is that healthier')).toBe(false);
    expect(isConciseQuery('and green tea')).toBe(false);
    expect(
      isConciseQuery('what are the health effects of four cups of coffee daily')
    ).toBe(false);
  });
});

describe('sanitizeSearchQuery', () => {
  it('strips surrounding quotes and label prefixes', () => {
    expect(sanitizeSearchQuery('"green tea daily intake"')).toBe(
      'green tea daily intake'
    );
    expect(sanitizeSearchQuery('Search query: green tea per day')).toBe(
      'green tea per day'
    );
    expect(sanitizeSearchQuery('“how much green tea per day”')).toBe(
      'how much green tea per day'
    );
  });

  it('drops a <think> block and keeps the first real line', () => {
    expect(
      sanitizeSearchQuery(
        '<think>the user means green tea</think>\ngreen tea per day'
      )
    ).toBe('green tea per day');
    expect(sanitizeSearchQuery('green tea per day\nextra rambling')).toBe(
      'green tea per day'
    );
  });

  it('returns empty for unusable output (blank or too long)', () => {
    expect(sanitizeSearchQuery('')).toBe('');
    expect(sanitizeSearchQuery('   ')).toBe('');
    expect(sanitizeSearchQuery('x'.repeat(200))).toBe('');
  });

  it('eats an unterminated <think> block instead of leaking it as a query', () => {
    expect(
      sanitizeSearchQuery('<think>the user means green tea\ngreen tea per day')
    ).toBe('');
  });
});

describe('parseSearchPlan', () => {
  it('parses a valid plan', () => {
    expect(
      parseSearchPlan(
        '{"needs_search": true, "intent": "x y", "queries": ["a b", "c d"]}'
      )
    ).toEqual({ needsSearch: true, intent: 'x y', queries: ['a b', 'c d'] });
  });

  it('strips a <think> block and extracts the JSON', () => {
    expect(
      parseSearchPlan(
        '<think>hmm the user wants coffee</think>\n{"needs_search": true, "intent": "coffee", "queries": ["coffee per day"]}'
      )
    ).toEqual({
      needsSearch: true,
      intent: 'coffee',
      queries: ['coffee per day'],
    });
  });

  it('extracts JSON embedded in surrounding prose', () => {
    expect(
      parseSearchPlan(
        'Here is the plan: {"needs_search": false, "intent": "chit chat", "queries": []} done'
      )
    ).toEqual({ needsSearch: false, intent: 'chit chat', queries: [] });
  });

  it('accepts a single-string queries value', () => {
    expect(
      parseSearchPlan(
        '{"needs_search": true, "intent": "", "queries": "bitcoin price"}'
      )?.queries
    ).toEqual(['bitcoin price']);
  });

  it('caps queries at the max sub-query count', () => {
    expect(
      parseSearchPlan(
        '{"needs_search": true, "intent": "", "queries": ["a","b","c","d"]}'
      )?.queries
    ).toEqual(['a', 'b']);
  });

  it('defaults needsSearch to true when the field is missing', () => {
    expect(
      parseSearchPlan('{"intent": "x", "queries": ["a"]}')?.needsSearch
    ).toBe(true);
  });

  it('sanitizes quotes/labels and drops empty queries', () => {
    expect(
      parseSearchPlan(
        '{"needs_search": true, "intent": "", "queries": ["query: \\"green tea per day\\"", "   "]}'
      )?.queries
    ).toEqual(['green tea per day']);
  });

  it('returns null when there is no JSON object', () => {
    expect(parseSearchPlan('no json here')).toBeNull();
    expect(parseSearchPlan('')).toBeNull();
  });

  it('never parses deliberation from an unterminated <think> as a plan', () => {
    expect(
      parseSearchPlan(
        '<think>maybe {"needs_search": false, "intent": "x", "queries": []}'
      )
    ).toBeNull();
  });
});

describe('planWebSearch', () => {
  it('returns no-search for an empty message, without calling the model', async () => {
    const generate = jest.fn();
    const plan = await planWebSearch('   ', [], generate);
    expect(plan).toEqual({ needsSearch: false, intent: '', queries: [] });
    expect(generate).not.toHaveBeenCalled();
  });

  it('sends an already-concise keyword query verbatim, without the LLM', async () => {
    const generate = jest.fn();
    const plan = await planWebSearch('current bitcoin price usd', [], generate);
    expect(plan).toEqual({
      needsSearch: true,
      intent: '',
      queries: ['current bitcoin price usd'],
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it('plans a complex question via the LLM and carries context + today', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": true, "intent": "coffee daily intake", "queries": ["how much coffee per day is safe"]}'
      );
    const plan = await planWebSearch(
      'how much of it should I drink each day?',
      history,
      generate,
      { today: TODAY }
    );
    expect(plan).toEqual({
      needsSearch: true,
      intent: 'coffee daily intake',
      queries: ['how much coffee per day is safe'],
    });
    expect(generate).toHaveBeenCalledTimes(1);
    const messages = generate.mock.calls[0][0];
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain(TODAY);
    expect(messages[1].content).toContain('does coffee help');
    expect(messages[1].content).toContain(
      'how much of it should I drink each day?'
    );
  });

  it('fans out into two sub-queries for a comparison', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": true, "intent": "compare phone cameras", "queries": ["iPhone 16 camera review", "Pixel 9 camera review"]}'
      );
    const plan = await planWebSearch(
      'which has a better camera, the iphone 16 or the pixel 9?',
      [],
      generate,
      { today: TODAY }
    );
    expect(plan.queries).toEqual([
      'iPhone 16 camera review',
      'Pixel 9 camera review',
    ]);
  });

  it('honors needs_search=false (no queries)', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": false, "intent": "write a poem", "queries": []}'
      );
    const plan = await planWebSearch(
      'write me a long poem about the sea and the moon',
      [],
      generate,
      { today: TODAY }
    );
    expect(plan).toEqual({
      needsSearch: false,
      intent: 'write a poem',
      queries: [],
    });
  });

  it('falls back to the verbatim message when the model throws', async () => {
    const generate = jest.fn().mockRejectedValue(new Error('no model'));
    const plan = await planWebSearch(
      'what are the long term effects of daily espresso on sleep?',
      [],
      generate,
      { today: TODAY }
    );
    expect(plan).toEqual({
      needsSearch: true,
      intent: '',
      queries: ['what are the long term effects of daily espresso on sleep?'],
    });
  });

  it('clamps a verbatim fallback to a searchable length at a word boundary', async () => {
    const generate = jest.fn().mockRejectedValue(new Error('no model'));
    const message = 'why does my sourdough starter smell like acetone '.repeat(
      8
    );
    const plan = await planWebSearch(message, [], generate, { today: TODAY });
    const [q] = plan.queries;
    expect(q!.length).toBeLessThanOrEqual(160);
    expect(message.startsWith(q!)).toBe(true);
    expect(q!.endsWith(' ')).toBe(false);
    expect(message[q!.length]).toBe(' ');
  });

  it('falls back to the verbatim message when the output is unparseable', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue('I think you should search for coffee stuff');
    const plan = await planWebSearch(
      'how does caffeine affect deep sleep over the long term?',
      [],
      generate,
      { today: TODAY }
    );
    expect(plan.needsSearch).toBe(true);
    expect(plan.queries).toEqual([
      'how does caffeine affect deep sleep over the long term?',
    ]);
  });

  it('falls back to verbatim (keeping intent) when search is wanted but no query is given', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": true, "intent": "coffee health", "queries": []}'
      );
    const plan = await planWebSearch(
      'is drinking a lot of coffee every single day bad for me?',
      [],
      generate,
      { today: TODAY }
    );
    expect(plan).toEqual({
      needsSearch: true,
      intent: 'coffee health',
      queries: ['is drinking a lot of coffee every single day bad for me?'],
    });
  });

  it('only feeds the last N turns and skips empty/system turns', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": true, "intent": "green tea", "queries": ["green tea per day"]}'
      );
    const long = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'first' },
      { role: 'assistant', content: '' },
      ...Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `turn ${i}`,
      })),
    ];
    await planWebSearch('how much of it should I drink?', long, generate, {
      today: TODAY,
    });
    const convo = generate.mock.calls[0][0][1].content as string;
    expect(convo).not.toContain('You are helpful.');
    expect(convo).not.toContain('first');
    expect(convo).toContain('turn 9');
  });
});
