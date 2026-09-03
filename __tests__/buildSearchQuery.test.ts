import {
  toKeywordQuery,
  parseSearchPlan,
  planWebSearch,
  sanitizeSearchQuery,
  extractSiteRestriction,
  carryReferentIntoQuery,
  isAboutTheConversation,
  isConversationalIntent,
} from '../utils/web/buildSearchQuery';

const history = [
  { role: 'user', content: 'I feel tired, does coffee help or make it worse?' },
  { role: 'assistant', content: 'Coffee can worsen fatigue over time…' },
];

const TODAY = '2026-07-17';

describe('toKeywordQuery', () => {
  it('drops the request wrapper and the quotes around the subject', () => {
    expect(toKeywordQuery('Sprawdź oferty produktu ‚wanna’ na olx')).toBe(
      'oferty produktu wanna na olx'
    );
    expect(toKeywordQuery('Znajdź najtańszy bilet do Krakowa')).toBe(
      'najtańszy bilet do Krakowa'
    );
    expect(toKeywordQuery('show me the current bitcoin price')).toBe(
      'the current bitcoin price'
    );
  });

  it('leaves a query that is already keywords alone', () => {
    expect(toKeywordQuery('warsaw weather forecast')).toBe(
      'warsaw weather forecast'
    );
  });

  it('never empties a query that is nothing but a request verb', () => {
    expect(toKeywordQuery('sprawdź')).toBe('sprawdź');
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
    ).toEqual(['a', 'b', 'c']);
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

  it('reads the plan kind from the closed set, whatever its case', () => {
    expect(
      parseSearchPlan(
        '{"needs_search": true, "intent": "x", "kind": "Specs", "queries": ["a"]}'
      )?.kind
    ).toBe('specs');
  });

  it('drops a kind outside the closed set instead of passing it on', () => {
    expect(
      parseSearchPlan(
        '{"needs_search": true, "intent": "x", "kind": "shopping", "queries": ["a"]}'
      )
    ).toEqual({ needsSearch: true, intent: 'x', queries: ['a'] });
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

  it('still consults the planner for a concise keyword query', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": true, "intent": "bitcoin price", "queries": ["bitcoin price usd today"]}'
      );
    const plan = await planWebSearch('current bitcoin price usd', [], generate);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(plan.needsSearch).toBe(true);
    expect(plan.queries).toEqual(['bitcoin price usd today']);
  });

  it('lets the planner gate a short greeting that is not a search', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": false, "intent": "casual greeting", "queries": []}'
      );
    const plan = await planWebSearch('hej, jak leci?', [], generate);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(plan).toEqual({
      needsSearch: false,
      intent: 'casual greeting',
      queries: [],
    });
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

  it('fans out into three sub-queries for a three-way comparison', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": true, "intent": "compare crypto prices", "queries": ["bitcoin price today", "ethereum price today", "solana price today"]}'
      );
    const plan = await planWebSearch(
      'compare the current prices of Bitcoin, Ethereum and Solana',
      [],
      generate,
      { today: TODAY }
    );
    expect(plan.queries).toEqual([
      'bitcoin price today',
      'ethereum price today',
      'solana price today',
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

  it("overrides needs_search=false when the plan's own intent is not one of the conversational categories its prompt defines (live-found Pixel gap — F31)", async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": false, "intent": "elon musk children", "queries": []}'
      );
    const plan = await planWebSearch('ile dzieci ma Elon Musk', [], generate, {
      today: TODAY,
    });
    expect(plan.needsSearch).toBe(true);
    expect(plan.queries).toEqual(['ile dzieci ma Elon Musk']);
  });

  it('overrides needs_search=false for a bare-role follow-up whose intent is still non-conversational (F31)', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": false, "intent": "president children", "queries": []}'
      );
    const plan = await planWebSearch(
      'wypisz imiona wszystkich dzieci prezydenta',
      [],
      generate,
      { today: TODAY }
    );
    expect(plan.needsSearch).toBe(true);
    expect(plan.queries).toEqual([
      'wypisz imiona wszystkich dzieci prezydenta',
    ]);
  });

  it('overrides needs_search=false when the model gives no intent at all', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": false, "intent": "", "queries": []}'
      );
    const plan = await planWebSearch('kurs euro dzisiaj', [], generate, {
      today: TODAY,
    });
    expect(plan.needsSearch).toBe(true);
    expect(plan.queries).toEqual(['kurs euro dzisiaj']);
  });

  it('still honors needs_search=false when the intent matches a conversational category', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": false, "intent": "casual greeting", "queries": []}'
      );
    const plan = await planWebSearch('hej, jak leci?', [], generate, {
      today: TODAY,
    });
    expect(plan).toEqual({
      needsSearch: false,
      intent: 'casual greeting',
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

  it('prepends the chat digest to the conversation sent to the LLM planner', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": true, "intent": "topic", "queries": ["topic query"]}'
      );
    await planWebSearch(
      'a co z tym drugim?',
      [
        { role: 'user', content: 'porównaj model A i model B' },
        { role: 'assistant', content: 'Model A jest szybszy.' },
      ],
      generate,
      { today: TODAY, digest: 'Topic: comparing Model A and Model B.' }
    );
    const convo = generate.mock.calls[0][0][1].content as string;
    expect(convo).toContain(
      'Conversation summary so far: Topic: comparing Model A and Model B.'
    );
  });

  describe('example leak guard', () => {
    it("drops a query that echoes the planner's own example entity", async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "current Tokyo weather", "queries": ["Tokyo weather today"]}'
        );
      const plan = await planWebSearch(
        'what is the weather today in Warsaw, do I need an umbrella?',
        [],
        generate,
        { today: TODAY }
      );
      expect(plan.queries).not.toContain('Tokyo weather today');
    });

    it('falls back to verbatim when every query leaks the example entity', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "sleep tips", "queries": ["Tokyo weather today"]}'
        );
      const plan = await planWebSearch(
        'Czuję się dziś zmęczony, może zrobisz mi listę porad na dobry sen?',
        [],
        generate,
        { today: TODAY }
      );
      expect(plan.queries).toEqual([
        toKeywordQuery(
          'Czuję się dziś zmęczony, może zrobisz mi listę porad na dobry sen?'
        ),
      ]);
    });

    it('keeps a query naming the same entity the planner was given', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "current Tokyo weather", "queries": ["Tokyo weather today"]}'
        );
      const plan = await planWebSearch(
        'what is the weather in Tokyo right now?',
        [],
        generate,
        { today: TODAY }
      );
      expect(plan.queries).toEqual(['Tokyo weather today']);
    });

    it('keeps an unrelated multi-query plan alongside a leaked one', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "weather and concert", "queries": ["Tokyo weather today", "Berlin concert traffic"]}'
        );
      const plan = await planWebSearch(
        'I am driving to a concert in Berlin today, how is the weather and the traffic?',
        [],
        generate,
        { today: TODAY }
      );
      expect(plan.queries).toEqual(['Berlin concert traffic']);
    });
  });

  describe('site restriction', () => {
    it('extracts a bare domain named in the message', () => {
      expect(
        extractSiteRestriction('Sprawdź na stronie Transfermarkt.pl kto...')
      ).toBe('transfermarkt.pl');
      expect(
        extractSiteRestriction('search only on wikipedia.org for this')
      ).toBe('wikipedia.org');
      expect(extractSiteRestriction('check www.espn.com please')).toBe(
        'espn.com'
      );
    });

    it('finds nothing when no domain-shaped token is present', () => {
      expect(extractSiteRestriction('what is the weather today')).toBeNull();
      expect(extractSiteRestriction('release notes v1.2.0')).toBeNull();
      expect(extractSiteRestriction('to jest sezon 2025/26.')).toBeNull();
    });

    it('injects a site: operator into the verbatim fallback query', async () => {
      const generate = jest.fn().mockRejectedValue(new Error('no model'));
      const plan = await planWebSearch(
        'sprawdź na stronie transfermarkt.pl kto strzelił najwięcej bramek',
        [],
        generate,
        { today: TODAY }
      );
      expect(plan.siteRestriction).toBe('transfermarkt.pl');
      expect(plan.queries[0]).toContain('site:transfermarkt.pl');
    });

    it('injects a site: operator into every LLM-planned query', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "poland goals", "queries": ["najwięcej bramek dla Polski reprezentacja"]}'
        );
      const plan = await planWebSearch(
        'sprawdź na stronie transfermarkt.pl kto strzelił najwięcej bramek dla Polski',
        [],
        generate,
        { today: TODAY }
      );
      expect(plan.siteRestriction).toBe('transfermarkt.pl');
      expect(plan.queries).toEqual([
        'najwięcej bramek dla Polski reprezentacja site:transfermarkt.pl',
      ]);
    });

    it('does not duplicate the site: operator if the model already added it', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "poland goals", "queries": ["najwięcej bramek site:transfermarkt.pl"]}'
        );
      const plan = await planWebSearch(
        'sprawdź na stronie transfermarkt.pl kto strzelił najwięcej bramek',
        [],
        generate,
        { today: TODAY }
      );
      expect(plan.queries).toEqual(['najwięcej bramek site:transfermarkt.pl']);
    });

    it('leaves queries and siteRestriction untouched when no site is named', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "bitcoin price", "queries": ["bitcoin price today"]}'
        );
      const plan = await planWebSearch('current bitcoin price', [], generate, {
        today: TODAY,
      });
      expect(plan.siteRestriction).toBeUndefined();
      expect(plan.queries).toEqual(['bitcoin price today']);
    });
  });

  describe('year regrounding', () => {
    it('replaces a stale year the model invented with the injected current year', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "Nobel Prize in Literature", "queries": ["Nobel Prize in Literature 2023"]}'
        );
      const plan = await planWebSearch(
        'kto ostatnio dostał Nobla z literatury?',
        [],
        generate,
        { today: '2026-07-17' }
      );
      expect(plan.queries).toEqual(['Nobel Prize in Literature 2026']);
    });

    it('trusts a year the user explicitly asked about', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "Oscars 2019 winner", "queries": ["Oscars 2019 best picture"]}'
        );
      const plan = await planWebSearch(
        'who won best picture at the 2019 Oscars?',
        [],
        generate,
        { today: '2026-07-17' }
      );
      expect(plan.queries).toEqual(['Oscars 2019 best picture']);
    });

    it('leaves last year alone (reigning-champion framing)', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "champion", "queries": ["league champion 2025"]}'
        );
      const plan = await planWebSearch(
        'who is the reigning champion?',
        [],
        generate,
        {
          today: '2026-07-17',
        }
      );
      expect(plan.queries).toEqual(['league champion 2025']);
    });
  });

  describe('language of the planned queries', () => {
    const oledHistory = [
      { role: 'user', content: 'jaki jest najlepszy tv OLED?' },
      {
        role: 'assistant',
        content:
          'Model LG OLED65B65LA znalazł się w zestawieniu najlepszych telewizorów OLED 2026.',
      },
    ];
    const question =
      'wypisz jakie ma funkcje i parametry techniczne oraz powiedz czy sprawdzi się w salonie z dużymi oknami';
    const driftedPlan =
      '{"needs_search": true, "intent": "TV features and suitability", "queries": ["best TV for large living room features", "TV technical specifications", "TV suitability for large windows"]}';
    const correctedPlan =
      '{"needs_search": true, "intent": "TV features and suitability", "queries": ["funkcje i parametry techniczne LG OLED65B65LA", "telewizor OLED do salonu z dużymi oknami"]}';

    it('asks the planner again when its queries are not in the language of the conversation (live #341)', async () => {
      const generate = jest
        .fn()
        .mockResolvedValueOnce(driftedPlan)
        .mockResolvedValueOnce(correctedPlan);
      const plan = await planWebSearch(question, oledHistory, generate, {
        today: TODAY,
      });
      expect(generate).toHaveBeenCalledTimes(2);
      const retry = generate.mock.calls[1]![0];
      expect(retry.slice(0, 2)).toEqual(generate.mock.calls[0]![0]);
      expect(retry[2]).toEqual({ role: 'assistant', content: driftedPlan });
      expect(retry[3].role).toBe('user');
      expect(retry[3].content).toMatch(/same language/);
      expect(plan.queries).toEqual([
        'funkcje i parametry techniczne LG OLED65B65LA',
        'telewizor OLED do salonu z dużymi oknami',
      ]);
    });

    it('falls back to the question itself when the retry drifts as well', async () => {
      const generate = jest.fn().mockResolvedValue(driftedPlan);
      const plan = await planWebSearch(question, oledHistory, generate, {
        today: TODAY,
      });
      expect(generate).toHaveBeenCalledTimes(2);
      expect(plan.queries).toEqual([toKeywordQuery(question)]);
    });

    it('keeps the queries that were in the right language when the retry fails', async () => {
      const mixedPlan =
        '{"needs_search": true, "intent": "TV features", "queries": ["parametry techniczne LG OLED65B65LA", "TV suitability for large windows"]}';
      const generate = jest
        .fn()
        .mockResolvedValueOnce(mixedPlan)
        .mockRejectedValueOnce(new Error('busy'));
      const plan = await planWebSearch(question, oledHistory, generate, {
        today: TODAY,
      });
      expect(plan.queries).toEqual(['parametry techniczne LG OLED65B65LA']);
    });

    it('carries the topic the user kept returning to into a planner query that dropped it (live #353)', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "cheaper TV", "queries": ["tańszy telewizor podobny"]}'
        );
      const plan = await planWebSearch(
        'Trochę za drogi znajdź tańszy spełniający moje wymagania',
        [
          ...oledHistory,
          {
            role: 'user',
            content:
              'Jeszcze raz wyszukaj tv do mojego salonu najlepszy tylko oled',
          },
          {
            role: 'assistant',
            content:
              'Najlepszym telewizorem OLED do salonu jest Samsung QE65S99H za 12 999 zł.',
          },
        ],
        generate,
        { today: TODAY }
      );
      expect(plan.queries).toEqual(['tańszy telewizor podobny OLED']);
    });

    it('does not ask twice when the plan already speaks the language of the conversation', async () => {
      const generate = jest.fn().mockResolvedValue(correctedPlan);
      await planWebSearch(question, oledHistory, generate, { today: TODAY });
      expect(generate).toHaveBeenCalledTimes(1);
    });
  });

  describe('kind of answer the question wants', () => {
    it('carries the planner kind out with the plan', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "TV specs", "kind": "specs", "queries": ["Samsung QE65S99H parametry techniczne"]}'
        );
      const plan = await planWebSearch(
        'Podaj parametry techniczne Samsung QE65S99H',
        [],
        generate,
        { today: TODAY }
      );
      expect(plan.kind).toBe('specs');
    });

    it('keeps the kind when every planned query is thrown out and the question is searched verbatim', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "TV price", "kind": "price", "queries": ["Tokyo weather today"]}'
        );
      const plan = await planWebSearch(
        'ile kosztuje Samsung QE65S99H?',
        [],
        generate,
        { today: TODAY }
      );
      expect(plan.queries).toEqual([
        toKeywordQuery('ile kosztuje Samsung QE65S99H?'),
      ]);
      expect(plan.kind).toBe('price');
    });

    it('tells the planner which kinds exist and shows one per example', async () => {
      const generate = jest.fn().mockResolvedValue('');
      await planWebSearch('ile kosztuje Samsung QE65S99H?', [], generate, {
        today: TODAY,
      });
      const system: string = generate.mock.calls[0]![0][0].content;
      expect(system).toMatch(/"kind": "<kind>"/);
      expect(system).toMatch(/"kind": "price"/);
      expect(system).toMatch(/"kind": "chat"/);
    });
  });
});

describe('extractSiteRestriction', () => {
  it('reads a real site the user names', () => {
    expect(extractSiteRestriction('ile kosztuje RTX 4070 na allegro.pl?')).toBe(
      'allegro.pl'
    );
    expect(
      extractSiteRestriction('How much are Nike Air Max on nike.com?')
    ).toBe('nike.com');
    expect(extractSiteRestriction('check https://www.otomoto.pl/oferty')).toBe(
      'otomoto.pl'
    );
  });

  it('does not read a library name as a site (live-found: Node.js searched site:node.js)', () => {
    for (const question of [
      'What is the latest version of Node.js?',
      'Jak zrobić routing w Next.js?',
      'Vue.js vs React porównanie',
      'How do I install pandas in main.py?',
    ]) {
      expect(extractSiteRestriction(question)).toBeNull();
    }
  });

  it('finds nothing in a question that names no site at all', () => {
    expect(
      extractSiteRestriction('ile kosztuje Samsung Galaxy S25')
    ).toBeNull();
  });
});

describe('isAboutTheConversation', () => {
  it('recognises a request to recap the thread (live-found: it triggered a fresh search)', () => {
    for (const question of [
      'Podsumuj wszystko czego sie dowiedzialem o tym telefonie',
      'Streszcz nasza rozmowe',
      'Summarise what we discussed',
      'Can you recap what I learned?',
      'To sum up, what did we cover?',
    ]) {
      expect(isAboutTheConversation(question)).toBe(true);
    }
  });

  it('leaves a question about the world alone', () => {
    for (const question of [
      'Ile kosztuje Samsung Galaxy S25?',
      'Jaka jest dzisiejsza pogoda w Warszawie?',
      'What is the latest version of Node.js?',
      'Porownaj cene bitcoina i ethereum',
      'Podaj sume opadow w Krakowie',
    ]) {
      expect(isAboutTheConversation(question)).toBe(false);
    }
  });

  it('stops the planner asking the web about the conversation', async () => {
    const generate = jest.fn();
    const plan = await planWebSearch(
      'Podsumuj wszystko czego sie dowiedzialem',
      [],
      generate,
      { rewrite: false }
    );
    expect(plan.needsSearch).toBe(false);
    expect(plan.queries).toEqual([]);
    expect(generate).not.toHaveBeenCalled();
  });
});

describe('carryReferentIntoQuery', () => {
  const withPresident = [
    { role: 'user', content: 'kto jest prezydentem usa?' },
    {
      role: 'assistant',
      content: 'Prezydentem USA jest obecnie Donald Trump.',
    },
  ];

  it('splices in the most recently named entity for a bare-role follow-up', () => {
    expect(
      carryReferentIntoQuery('ile dzieci ma prezydent?', withPresident)
    ).toBe('ile dzieci ma prezydent? Donald Trump');
  });

  it('keeps a model number that is part of the name, instead of truncating it', () => {
    const aboutPhone = [
      { role: 'user', content: 'co wiesz o Samsung Galaxy S25' },
      { role: 'assistant', content: 'Samsung Galaxy S25 to flagowiec.' },
    ];
    expect(carryReferentIntoQuery('a ile on kosztuje?', aboutPhone)).toBe(
      'a ile on kosztuje? Samsung Galaxy S25'
    );
  });

  it('does not swallow a standalone number that follows a name', () => {
    const aboutMusk = [
      { role: 'user', content: 'ile dzieci ma Elon Musk' },
      { role: 'assistant', content: 'Elon Musk ma 14 dzieci.' },
    ];
    expect(carryReferentIntoQuery('a ile on ma lat?', aboutMusk)).toBe(
      'a ile on ma lat? Elon Musk'
    );
  });

  it('does the same for an English pronoun follow-up', () => {
    const withCeo = [
      { role: 'user', content: 'who is the CEO of Tesla?' },
      { role: 'assistant', content: 'The CEO of Tesla is Elon Musk.' },
    ];
    expect(carryReferentIntoQuery('how many kids does he have?', withCeo)).toBe(
      'how many kids does he have? Elon Musk'
    );
  });

  it('leaves a query alone when it already names someone', () => {
    expect(
      carryReferentIntoQuery('ile dzieci ma Donald Trump?', withPresident)
    ).toBe('ile dzieci ma Donald Trump?');
  });

  it('does not mistake a capital letter mid-word for a proper noun (live-found: "iPhone Air" -> "Phone Air")', () => {
    const comparingPhones = [
      {
        role: 'user',
        content: 'Porownaj iPhone 17 Pro i iPhone Air pod wzgledem wagi.',
      },
      {
        role: 'assistant',
        content: '(1) iPhone 17 Pro weight: 206g\n(2) iPhone Air weight: 165g',
      },
    ];
    expect(
      carryReferentIntoQuery(
        'A ile on kosztuje, ten pierwszy?',
        comparingPhones
      )
    ).toBe('A ile on kosztuje, ten pierwszy?');
  });

  it('leaves a query alone with no referent marker at all', () => {
    expect(
      carryReferentIntoQuery('jaka jest cena bitcoina?', withPresident)
    ).toBe('jaka jest cena bitcoina?');
  });

  it('leaves a query alone when history has no named entity to carry', () => {
    const smallTalk = [
      { role: 'user', content: 'hej, jak leci?' },
      { role: 'assistant', content: 'Wszystko dobrze, dzięki!' },
    ];
    expect(carryReferentIntoQuery('ile ma lat prezydent?', smallTalk)).toBe(
      'ile ma lat prezydent?'
    );
  });

  it('splices in the entity for a Polish zero-subject follow-up with no pronoun at all (F31)', () => {
    expect(carryReferentIntoQuery('a kiedy się urodził?', withPresident)).toBe(
      'a kiedy się urodził? Donald Trump'
    );
  });

  it('does not misfire on a short but self-contained new question that happens to be brief', () => {
    expect(
      carryReferentIntoQuery('jaka jest cena bitcoina?', withPresident)
    ).toBe('jaka jest cena bitcoina?');
  });

  it('does not fire on "się" buried in an otherwise long, self-contained sentence', () => {
    const longQuery =
      'czy zgadzasz się, że trzeba to zmienić w całym systemie edukacji?';
    expect(carryReferentIntoQuery(longQuery, withPresident)).toBe(longQuery);
  });

  it('falls back to the digest when no entity is in history at all', () => {
    const smallTalk = [
      { role: 'user', content: 'hej, jak leci?' },
      { role: 'assistant', content: 'Wszystko dobrze, dzięki!' },
    ];
    expect(
      carryReferentIntoQuery(
        'ile ma lat prezydent?',
        smallTalk,
        'Topic: the president of some fictional country.'
      )
    ).toBe(
      'ile ma lat prezydent? Topic: the president of some fictional country.'
    );
  });

  it('falls back to the digest for a real comparison with no matchable entity (iPhone 17 Pro vs iPhone Air)', () => {
    const comparingPhones = [
      {
        role: 'user',
        content: 'Porownaj iPhone 17 Pro i iPhone Air pod wzgledem wagi.',
      },
      {
        role: 'assistant',
        content: '(1) iPhone 17 Pro weight: 206g\n(2) iPhone Air weight: 165g',
      },
    ];
    expect(
      carryReferentIntoQuery(
        'A ile on kosztuje, ten pierwszy?',
        comparingPhones,
        'Topic: comparing iPhone 17 Pro and iPhone Air by weight.'
      )
    ).toBe(
      'A ile on kosztuje, ten pierwszy? Topic: comparing iPhone 17 Pro and iPhone Air by weight.'
    );
  });

  it('prefers a matched entity over the digest when both are available', () => {
    expect(
      carryReferentIntoQuery(
        'ile dzieci ma prezydent?',
        withPresident,
        'Topic: some unrelated digest text.'
      )
    ).toBe('ile dzieci ma prezydent? Donald Trump');
  });

  it('leaves the query alone when there is neither an entity nor a digest', () => {
    const smallTalk = [
      { role: 'user', content: 'hej, jak leci?' },
      { role: 'assistant', content: 'Wszystko dobrze, dzięki!' },
    ];
    expect(carryReferentIntoQuery('ile ma lat prezydent?', smallTalk)).toBe(
      'ile ma lat prezydent?'
    );
  });

  it('splices the entity into a Polish follow-up whose subject is dropped entirely (live: "A jaki ma aparat?" searched for nothing)', () => {
    const aboutPhone = [
      { role: 'user', content: 'Ile kosztuje Samsung Galaxy S25 w Polsce' },
      { role: 'assistant', content: 'Ten model kosztuje 3999 zl.' },
    ];
    expect(carryReferentIntoQuery('A jaki ma aparat?', aboutPhone)).toBe(
      'A jaki ma aparat? Samsung Galaxy S25'
    );
    expect(
      carryReferentIntoQuery(
        'Ile ma pamieci RAM i jakiego ma procesora?',
        aboutPhone
      )
    ).toBe('Ile ma pamieci RAM i jakiego ma procesora? Samsung Galaxy S25');
    expect(
      carryReferentIntoQuery('Czy jest dostepny w kolorze czarnym?', aboutPhone)
    ).toBe('Czy jest dostepny w kolorze czarnym? Samsung Galaxy S25');
  });

  it('does not read a subject that follows its verb as a dropped one', () => {
    const aboutPhone = [
      { role: 'user', content: 'Ile kosztuje Samsung Galaxy S25 w Polsce' },
      { role: 'assistant', content: 'Ten model kosztuje 3999 zl.' },
    ];
    for (const selfContained of [
      'Ile kosztuje aktualnie cyna?',
      'Ile kalorii ma banan?',
      'Jaka jest dzisiejsza pogoda w Warszawie?',
    ]) {
      expect(carryReferentIntoQuery(selfContained, aboutPhone)).toBe(
        selfContained
      );
    }
  });

  it('splices the entity into a follow-up that points back with a demonstrative', () => {
    const aboutMetals = [
      { role: 'user', content: 'Ile kosztuje uncja Gold Bullion?' },
      { role: 'assistant', content: 'Gold Bullion kosztuje 1573 USD.' },
    ];
    expect(
      carryReferentIntoQuery('Porownaj je i daj mi wyniki', aboutMetals)
    ).toBe('Porownaj je i daj mi wyniki Gold Bullion');
    expect(
      carryReferentIntoQuery(
        'Who was the top scorer in that game?',
        aboutMetals
      )
    ).toBe('Who was the top scorer in that game? Gold Bullion');
  });

  it('does not read a date expression as a demonstrative pointing back', () => {
    const aboutMetals = [
      { role: 'user', content: 'Ile kosztuje uncja Gold Bullion?' },
      { role: 'assistant', content: 'Gold Bullion kosztuje 1573 USD.' },
    ];
    for (const temporal of [
      'Jakie sa najwazniejsze wydarzenia na swiecie w tym tygodniu?',
      'Ktory metal zyskal najwiecej w tym miesiacu?',
      'What were the biggest stories this week?',
    ]) {
      expect(carryReferentIntoQuery(temporal, aboutMetals)).toBe(temporal);
    }
  });

  it('does not carry a capitalized sentence opener glued to the entity (live: "Cena Samsunga Galaxy")', () => {
    const aboutPhone = [
      { role: 'user', content: 'Ile kosztuje Samsung Galaxy S25 w Polsce' },
      {
        role: 'assistant',
        content: 'Cena Samsunga Galaxy S25 w Polsce wynosi 3999 zl.',
      },
    ];
    expect(carryReferentIntoQuery('A jaki ma aparat?', aboutPhone)).toBe(
      'A jaki ma aparat? Samsung Galaxy S25'
    );
  });

  it('still carries an entity only the assistant ever named', () => {
    expect(carryReferentIntoQuery('a kiedy się urodził?', withPresident)).toBe(
      'a kiedy się urodził? Donald Trump'
    );
  });

  it('treats "it" and Polish "go" as referents (live-found: two turns searched with no product)', () => {
    const aboutPhone = [
      { role: 'user', content: 'Ile kosztuje Samsung Galaxy S25 w Polsce?' },
      { role: 'assistant', content: 'Cena to 2499 zl.' },
    ];
    expect(
      carryReferentIntoQuery(
        'Czy warto go kupic teraz, czy poczekac na promocje?',
        aboutPhone
      )
    ).toBe(
      'Czy warto go kupic teraz, czy poczekac na promocje? Samsung Galaxy S25'
    );
    expect(
      carryReferentIntoQuery('Where can I buy it cheapest?', aboutPhone)
    ).toBe('Where can I buy it cheapest? Samsung Galaxy S25');
    expect(carryReferentIntoQuery('Ile on kosztuje?', aboutPhone)).toBe(
      'Ile on kosztuje? Samsung Galaxy S25'
    );
  });

  it('does not fire on a word that merely contains a pronoun', () => {
    const aboutPhone = [
      { role: 'user', content: 'Ile kosztuje Samsung Galaxy S25 w Polsce?' },
      { role: 'assistant', content: 'Cena to 2499 zl.' },
    ];
    for (const selfContained of [
      'Jaka jest dzisiejsza pogoda w Warszawie?',
      'Ile kosztuje aktualnie cyna?',
      'Ktory bank ma najlepsze oprocentowanie?',
    ]) {
      expect(carryReferentIntoQuery(selfContained, aboutPhone)).toBe(
        selfContained
      );
    }
  });

  it('prefers the most recent entity over an earlier one', () => {
    const twoPresidents = [
      { role: 'user', content: 'kto jest prezydentem Francji?' },
      {
        role: 'assistant',
        content: 'Prezydentem Francji jest Emmanuel Macron.',
      },
      { role: 'user', content: 'a kto jest prezydentem USA?' },
      { role: 'assistant', content: 'Prezydentem USA jest Donald Trump.' },
    ];
    expect(carryReferentIntoQuery('ile ma lat prezydent?', twoPresidents)).toBe(
      'ile ma lat prezydent? Donald Trump'
    );
  });

  it('carries the model the last answer settled on, not the last capitalised run in it (live #349-#351: "Smart TV")', () => {
    const oledChat = [
      {
        role: 'user',
        content: 'Podaj parametry techniczne tv samsung QE65QN90D',
      },
      {
        role: 'assistant',
        content:
          'Samsung QE65QN90D ma matrycę 120Hz i obsługuje HDMI 2.1. Samsung QE65QN90D kosztuje 5999 zł.',
      },
      {
        role: 'user',
        content:
          'Jeszcze raz wyszukaj tv do mojego salonu najlepszy tylko oled',
      },
      {
        role: 'assistant',
        content:
          'Najlepszym telewizorem OLED jest Samsung QE65S99H, ponieważ zachwyci Cię paletą barw. Matowy ekran z powłoką Glare Free sprawdzi się w salonie. Wyróżnione modele oferują platformy Smart TV.',
      },
    ];
    expect(carryReferentIntoQuery('Jaka jest jego cena?', oledChat)).toBe(
      'Jaka jest jego cena? Samsung QE65S99H'
    );
  });

  it('is wired end to end through planWebSearch in verbatim mode', async () => {
    const generate = jest.fn();
    const plan = await planWebSearch(
      'ile dzieci ma prezydent?',
      withPresident,
      generate,
      { rewrite: false }
    );
    expect(generate).not.toHaveBeenCalled();
    expect(plan.queries).toEqual(['ile dzieci ma prezydent? Donald Trump']);
  });

  it('also carries the referent into a query the LLM planner itself produced (F30 — live-found gap, "how many children does the president have" retrieved Joe Biden pages under a Trump follow-up)', async () => {
    const generate = jest.fn().mockResolvedValue(
      JSON.stringify({
        needs_search: true,
        intent: "the president's children and wife",
        queries: ['ile dzieci ma prezydent', 'jak nazywa sie zona prezydenta'],
      })
    );
    const plan = await planWebSearch(
      'ile dzieci ma prezydent i jak nazywa sie jego zona?',
      withPresident,
      generate
    );
    expect(plan.queries).toEqual([
      'ile dzieci ma prezydent Donald Trump',
      'jak nazywa sie zona prezydenta Donald Trump',
    ]);
  });

  it('threads a chat-level digest through planWebSearch when no entity is in history', async () => {
    const smallTalk = [
      { role: 'user', content: 'hej, jak leci?' },
      { role: 'assistant', content: 'Wszystko dobrze, dzięki!' },
    ];
    const generate = jest.fn();
    const plan = await planWebSearch(
      'ile ma lat prezydent?',
      smallTalk,
      generate,
      { rewrite: false, digest: 'Topic: comparing Model A and Model B.' }
    );
    expect(plan.queries).toEqual([
      'ile ma lat prezydent? Topic: comparing Model A and Model B.',
    ]);
  });
});

describe('isConversationalIntent', () => {
  it('recognizes every conversational category the planner prompt itself defines as needing no search', () => {
    expect(isConversationalIntent('casual greeting')).toBe(true);
    expect(isConversationalIntent('creative writing')).toBe(true);
    expect(isConversationalIntent('personal advice')).toBe(true);
    expect(isConversationalIntent('programming language opinion')).toBe(true);
    expect(isConversationalIntent('thanking the assistant')).toBe(true);
    expect(isConversationalIntent('translate this sentence')).toBe(true);
    expect(isConversationalIntent('rewrite the paragraph')).toBe(true);
    expect(isConversationalIntent('basic math question')).toBe(true);
    expect(isConversationalIntent('debugging code')).toBe(true);
    expect(isConversationalIntent('general knowledge')).toBe(true);
  });

  it('does not recognize an intent describing a real-world fact, in any language the query itself was in — intent is always written in English', () => {
    expect(isConversationalIntent('elon musk children')).toBe(false);
    expect(isConversationalIntent('president children')).toBe(false);
    expect(isConversationalIntent('current gold price')).toBe(false);
    expect(isConversationalIntent('CEO of Tesla')).toBe(false);
  });

  it('does not trust an empty or missing intent as evidence of being conversational', () => {
    expect(isConversationalIntent('')).toBe(false);
    expect(isConversationalIntent('   ')).toBe(false);
  });
});
