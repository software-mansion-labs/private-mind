import {
  toKeywordQuery,
  parseSearchPlan,
  planWebSearch,
  sanitizeSearchQuery,
  extractSiteRestriction,
  carryReferentIntoQuery,
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

  describe('example leak guard', () => {
    it("drops a query that echoes the planner's own example entity", async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "current Tokyo weather", "queries": ["Tokyo weather today"]}'
        );
      const plan = await planWebSearch(
        'Nie wiem czy zabrać parasol jutro, wybieram się do Warszawy.',
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
        'jaka jest teraz pogoda w Tokyo?',
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
        'Za tydzień jadę na koncert do Berlina, ciekawe jakie będą korki.',
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
          '{"needs_search": true, "intent": "poland goals", "queries": ["poland national team top scorer"]}'
        );
      const plan = await planWebSearch(
        'sprawdź na stronie transfermarkt.pl kto strzelił najwięcej bramek dla Polski',
        [],
        generate,
        { today: TODAY }
      );
      expect(plan.siteRestriction).toBe('transfermarkt.pl');
      expect(plan.queries).toEqual([
        'poland national team top scorer site:transfermarkt.pl',
      ]);
    });

    it('does not duplicate the site: operator if the model already added it', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "poland goals", "queries": ["poland top scorer site:transfermarkt.pl"]}'
        );
      const plan = await planWebSearch(
        'sprawdź na stronie transfermarkt.pl kto strzelił najwięcej bramek',
        [],
        generate,
        { today: TODAY }
      );
      expect(plan.queries).toEqual(['poland top scorer site:transfermarkt.pl']);
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
        queries: [
          'how many children does the president have',
          "name of the president's wife",
        ],
      })
    );
    const plan = await planWebSearch(
      'ile dzieci ma prezydent i jak nazywa sie jego zona?',
      withPresident,
      generate
    );
    expect(plan.queries).toEqual([
      'how many children does the president have Donald Trump',
      "name of the president's wife Donald Trump",
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
