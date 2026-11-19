import {
  buildDigestPrompt,
  DIGEST_MAX_CHARS,
  DIGEST_STOP_RAW_CHARS,
  digestReplyIsComplete,
  firstTopicLine,
  looksLikePromptEcho,
  looksLikeAnswerEcho,
  stripMetaFrame,
  updateConversationDigest,
  visibleDigestText,
} from '../utils/conversationDigest';

describe('buildDigestPrompt', () => {
  it('labels a fresh conversation with no prior digest', () => {
    const messages = buildDigestPrompt(
      null,
      'Kto jest prezydentem Francji?',
      'Emmanuel Macron.'
    );
    expect(messages[1]!.content).toContain('Previous topic: none yet');
    expect(messages[1]!.content).toContain('Kto jest prezydentem Francji?');
    expect(messages[1]!.content).toContain('Emmanuel Macron.');
  });

  it('carries the previous digest forward for an incremental update', () => {
    const messages = buildDigestPrompt(
      'Topic: Emmanuel Macron, president of France.',
      'A kiedy się urodził?',
      'Urodził się 21 grudnia 1977 roku.'
    );
    expect(messages[1]!.content).toContain(
      'Previous topic: Topic: Emmanuel Macron, president of France.'
    );
  });
});

describe('updateConversationDigest', () => {
  it('returns the generated digest, clamped to DIGEST_MAX_CHARS', async () => {
    const long = 'x'.repeat(DIGEST_MAX_CHARS + 50);
    const generate = jest.fn().mockResolvedValue(long);

    const result = await updateConversationDigest(generate, null, 'q', 'a');

    expect(result.length).toBe(DIGEST_MAX_CHARS + 1); // + ellipsis
    expect(result.endsWith('…')).toBe(true);
  });

  it('trims whitespace around the generated digest', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue('  Discussing bitcoin price.  ');

    expect(await updateConversationDigest(generate, null, 'q', 'a')).toBe(
      'Discussing bitcoin price.'
    );
  });

  it('strips a <think> block before storing the digest (live-found: raw tags were leaking into the stored digest)', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '<think>\n\n</think>\n\niPhone 17 Pro and iPhone Air weight comparison'
      );

    expect(await updateConversationDigest(generate, null, 'q', 'a')).toBe(
      'iPhone 17 Pro and iPhone Air weight comparison'
    );
  });

  it('falls back to the previous digest when the model only produced reasoning with no visible text', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        `<think>${'wciaz rozwazam co powiedziec, bo pytanie jest zlozone. '.repeat(6)}`
      );

    expect(
      await updateConversationDigest(generate, 'Old summary.', 'q', 'a')
    ).toBe('Old summary.');
  });

  it('falls back to the previous digest when generation throws', async () => {
    const generate = jest.fn().mockRejectedValue(new Error('model busy'));

    expect(
      await updateConversationDigest(generate, 'Old summary.', 'q', 'a')
    ).toBe('Old summary.');
  });

  it('falls back to the previous digest when the model returns nothing', async () => {
    const generate = jest.fn().mockResolvedValue('');

    expect(
      await updateConversationDigest(generate, 'Old summary.', 'q', 'a')
    ).toBe('Old summary.');
  });

  it('returns an empty string when there is no previous digest and generation fails', async () => {
    const generate = jest.fn().mockRejectedValue(new Error('model busy'));

    expect(await updateConversationDigest(generate, null, 'q', 'a')).toBe('');
  });

  it('skips generation entirely for an empty question or answer', async () => {
    const generate = jest.fn();

    expect(await updateConversationDigest(generate, 'Old.', '', 'a')).toBe(
      'Old.'
    );
    expect(await updateConversationDigest(generate, 'Old.', 'q', '')).toBe(
      'Old.'
    );
    expect(generate).not.toHaveBeenCalled();
  });
});

describe('the digest must not just parrot the answer back', () => {
  const summarize = (text: string) => jest.fn(async () => text);

  it('rejects a digest that is the answer verbatim, keeping the topic instead', async () => {
    const answer =
      '<think>\n\n</think>\n\nCena Samsunga Galaxy S25 wynosi 299 zl.';
    const digest = await updateConversationDigest(
      summarize('Cena Samsunga Galaxy S25 wynosi 299 zl.'),
      null,
      'ile kosztuje Samsung Galaxy S25',
      answer
    );
    expect(digest).toBe('ile kosztuje Samsung Galaxy S25');
    expect(digest).not.toContain('299');
  });

  it('rejects a digest that merely repeats how the answer opens', async () => {
    const answer =
      'Aby zaparzyc dobra kawe w kawiarce, nalezy wykonac nastepujace kroki: 1. Zakladaj kawe. 2. Podgrzej.';
    const digest = await updateConversationDigest(
      summarize(
        'Aby zaparzyc dobra kawe w kawiarce, nalezy wykonac nastepujace kroki: Zakladaj kawe i zapal kawe.'
      ),
      null,
      'jak zaparzyc dobra kawe w kawiarce',
      answer
    );
    expect(digest).toBe('jak zaparzyc dobra kawe w kawiarce');
  });

  it('keeps a real summary that does not track the answer', async () => {
    const digest = await updateConversationDigest(
      summarize('tips for staying focused while working'),
      null,
      'give me 5 tips for staying focused',
      '1. Set clear goals. 2. Create a dedicated workspace. 3. Take breaks.'
    );
    expect(digest).toBe('tips for staying focused while working');
  });

  it('does not call a very short summary an echo on lead words alone', () => {
    expect(
      looksLikeAnswerEcho('Kawa i kawiarka', 'Kawa i mleko sa potrzebne')
    ).toBe(false);
  });

  it('ignores punctuation, case and diacritics when comparing', () => {
    expect(
      looksLikeAnswerEcho(
        'Cena Samsunga Galaxy S25 wynosi 299 zl',
        '**Cena Samsunga Galaxy S25 wynosi 299 zl.**'
      )
    ).toBe(true);
  });

  it('says nothing is an echo when either side is empty', () => {
    expect(looksLikeAnswerEcho('', 'anything')).toBe(false);
    expect(looksLikeAnswerEcho('anything', '')).toBe(false);
  });
});

describe('the digest is spliced into a search query, so it must read like one', () => {
  it('drops the meta-frame the model writes around the topic', () => {
    expect(
      stripMetaFrame(
        'The user is asking about the process of making a good cup of coffee in a cafe.'
      )
    ).toBe('the process of making a good cup of coffee in a cafe.');
    expect(
      stripMetaFrame('The conversation is about baking a chocolate cake.')
    ).toBe('baking a chocolate cake.');
  });

  it('drops the trailing entity inventory, which is commentary, not query terms', () => {
    expect(
      stripMetaFrame(
        'The user is asking about coffee brewing. The key entities are coffee and cafe.'
      )
    ).toBe('coffee brewing.');
  });

  it('leaves a topic phrase that is already query-shaped alone', () => {
    expect(stripMetaFrame('parzenie kawy w kawiarce, stopien zmielenia')).toBe(
      'parzenie kawy w kawiarce, stopien zmielenia'
    );
    expect(stripMetaFrame('Samsung Galaxy S25 price comparison')).toBe(
      'Samsung Galaxy S25 price comparison'
    );
  });

  it('never strips a topic down to nothing', () => {
    expect(stripMetaFrame('The key entities are coffee and cafe.')).toBe(
      'The key entities are coffee and cafe.'
    );
  });

  it('removes wrapping quotes the model sometimes adds', () => {
    expect(stripMetaFrame('"coffee brewing"')).toBe('coffee brewing');
  });

  it('runs on the way into storage, not only in the tests', async () => {
    const digest = await updateConversationDigest(
      jest.fn(
        async () => 'The user is asking about coffee brewing in a moka pot.'
      ),
      null,
      'jak zaparzyc kawe',
      'Wsyp kawe do kawiarki i podgrzej.'
    );
    expect(digest).toBe('coffee brewing in a moka pot.');
  });
});

describe('a utility generation that never closes its think tag (live-found)', () => {
  it('keeps the topic the model wrote inside an unterminated think block', () => {
    expect(visibleDigestText('<think>\n\nhamulce tarczowe lepsze')).toBe(
      'hamulce tarczowe lepsze'
    );
  });

  it('still prefers real visible text when the block is closed properly', () => {
    expect(
      visibleDigestText('<think>\nrozwazam\n</think>\n\nrowery gorskie')
    ).toBe('rowery gorskie');
  });

  it('returns nothing when there is nothing anywhere', () => {
    expect(visibleDigestText('')).toBe('');
    expect(visibleDigestText('<think>\n\n</think>')).toBe('');
  });

  it('stops the digest freezing on the previous topic when the model gets cut off', async () => {
    const digest = await updateConversationDigest(
      jest.fn(async () => '<think>\n\nhamulce tarczowe lepsze'),
      'rowery gorskie dla poczatkujacych',
      'a jakie hamulce sa lepsze',
      'Hamulce tarczowe sa lepsze niz szczekowe, bo lepiej hamuja.'
    );
    expect(digest).toBe('hamulce tarczowe lepsze');
  });
});

describe('the echo guard must not eat a legitimate short topic phrase', () => {
  it('leaves a topic phrase alone even when the answer opens the same way (live-found)', () => {
    expect(
      looksLikeAnswerEcho(
        'najlepszy rower górski dla początkujących',
        'Najlepszy rower górski dla początkujących to rower z lekką ramą i szerokimi oponami.'
      )
    ).toBe(false);
  });

  it('still catches a digest that reproduces the answer at length', () => {
    expect(
      looksLikeAnswerEcho(
        'Aby zaparzyc dobra kawe w kawiarce, nalezy wykonac nastepujace kroki: Zakladaj kawe.',
        'Aby zaparzyc dobra kawe w kawiarce, nalezy wykonac nastepujace kroki: 1. Zakladaj kawe. 2. Podgrzej.'
      )
    ).toBe(true);
  });

  it('still catches a short digest that is contained in the answer verbatim', () => {
    expect(
      looksLikeAnswerEcho(
        'Cena Samsunga Galaxy S25 wynosi 299 zl',
        'Cena Samsunga Galaxy S25 wynosi 299 zl.'
      )
    ).toBe(true);
  });
});

describe('the echo fallback must not throw away the subject (live-found)', () => {
  it('keeps a digest that names the product over a subject-less follow-up question', async () => {
    const generate = jest.fn(async () => 'A jaki ma aparat? Aparat to 48MP.');
    const digest = await updateConversationDigest(
      generate,
      'cena Samsung Galaxy S25 w Polsce',
      'A jaki ma aparat?',
      'A jaki ma aparat? Aparat to 48MP.'
    );
    expect(digest).toBe('cena Samsung Galaxy S25 w Polsce');
  });

  it('still falls back to the question when it names the subject itself', async () => {
    const generate = jest.fn(async () => 'Ile kosztuje Toyota Corolla 2018?');
    const digest = await updateConversationDigest(
      generate,
      'ceny aut',
      'Ile kosztuje Toyota Corolla 2018?',
      'Ile kosztuje Toyota Corolla 2018?'
    );
    expect(digest).toBe('Ile kosztuje Toyota Corolla 2018?');
  });

  it('still falls back to the question when there is no previous digest', async () => {
    const generate = jest.fn(async () => 'A jaki ma aparat?');
    const digest = await updateConversationDigest(
      generate,
      null,
      'A jaki ma aparat?',
      'A jaki ma aparat?'
    );
    expect(digest).toBe('A jaki ma aparat?');
  });
});

describe('a small model can hand back the prompt it was given', () => {
  const EXAMPLE = 'parzenie kawy w kawiarce, stopien zmielenia';

  it('recognises the example the prompt itself spells out', () => {
    expect(looksLikePromptEcho(EXAMPLE)).toBe(true);
  });

  it('recognises a fragment of the instructions copied out verbatim', () => {
    expect(looksLikePromptEcho('Output ONLY that phrase')).toBe(true);
  });

  it('leaves a real topic alone', () => {
    expect(looksLikePromptEcho('Warsaw weather tomorrow')).toBe(false);
  });

  it('judges nothing on a single word, which could land anywhere', () => {
    expect(looksLikePromptEcho('phrase')).toBe(false);
  });

  it('stores the question instead of the example it was shown', async () => {
    const digest = await updateConversationDigest(
      jest.fn(async () => EXAMPLE),
      null,
      'What is the weather in Warsaw today?',
      'Warsaw is 21°C and mostly sunny.'
    );

    expect(digest).toBe('What is the weather in Warsaw today?');
  });

  it('keeps a topic the model actually wrote', async () => {
    const digest = await updateConversationDigest(
      jest.fn(async () => 'Warsaw weather, today and tomorrow'),
      null,
      'What is the weather in Warsaw today?',
      'Warsaw is 21°C and mostly sunny.'
    );

    expect(digest).toBe('Warsaw weather, today and tomorrow');
  });
});

describe('a digest ends with its topic line (LFM 3 1.7B wrote on into a made-up conversation, iPhone 17)', () => {
  const lfm3Digest =
    "joke, scarecrow joke\n\nUser: Another one  \nAssistant: Sure! Here's another one:\n\nWhy did the math book look sad?";

  it('is complete once the first topic line has ended', () => {
    expect(digestReplyIsComplete('joke, scarecrow joke')).toBe(false);
    expect(digestReplyIsComplete('joke, scarecrow joke\n')).toBe(true);
  });

  it('waits past a bare label line for the topic itself', () => {
    expect(digestReplyIsComplete('Updated topic:\n')).toBe(false);
    expect(digestReplyIsComplete('Updated topic:\njoke\n')).toBe(true);
  });

  it('waits for a think block to close before judging the topic line', () => {
    expect(digestReplyIsComplete('<think>\nthe user wants\n')).toBe(false);
    expect(digestReplyIsComplete('<think>\n\n</think>\n\njoke\n')).toBe(true);
  });

  it('gives up on a reply that never ends a line', () => {
    expect(digestReplyIsComplete('a'.repeat(DIGEST_MAX_CHARS * 2))).toBe(true);
    expect(
      digestReplyIsComplete(`<think>${'x'.repeat(DIGEST_STOP_RAW_CHARS)}`)
    ).toBe(true);
  });

  it('keeps only the topic line of a reply that wrote on', async () => {
    const generate = jest.fn().mockResolvedValue(lfm3Digest);

    expect(
      await updateConversationDigest(
        generate,
        null,
        'Another one',
        'Why did the math book look sad?'
      )
    ).toBe('joke, scarecrow joke');
  });

  it('drops a leading topic label from the kept line', () => {
    expect(firstTopicLine('Updated topic: parzenie kawy\nUser: hi')).toBe(
      'parzenie kawy'
    );
  });
});
