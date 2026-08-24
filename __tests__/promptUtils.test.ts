import { prepareMessagesForLLM } from '../utils/promptUtils';
import { looksLikeNoAnswer } from '../utils/messageSources';
import { sourceBlock } from '../utils/contextUtils';
import {
  Message,
  ChatSettings,
  SourceDocument,
} from '../database/chatRepository';
import { Model } from '../database/modelRepository';
import { getPromptCharBudget } from '../constants/context-window';

const baseSettings = {
  systemPrompt: 'You are a helpful assistant.',
  thinkingEnabled: false,
} as ChatSettings;

const baseModel: Model = {
  id: 1,
  modelName: 'TestModel',
  source: 'local',
  isDownloaded: true,
  modelPath: '/path/model.pte',
  tokenizerPath: '/path/tokenizer.json',
  tokenizerConfigPath: '/path/tokenizer_config.json',
  thinking: false,
};

const makeMessages = (count: number): Message[] => [
  ...Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    chatId: 1,
    role: (i % 2 === 0 ? 'user' : 'assistant') as Message['role'],
    content: `message ${i + 1}`,
    timestamp: Date.now(),
  })),
  {
    id: count + 1,
    chatId: 1,
    role: 'assistant' as Message['role'],
    content: '',
    timestamp: Date.now(),
  },
];

describe('prepareMessagesForLLM', () => {
  describe('system prompt', () => {
    it('always prepends the system prompt', () => {
      const messages = makeMessages(2);
      const result = prepareMessagesForLLM(
        messages,
        [],
        baseSettings,
        baseModel
      );
      expect(result[0].role).toBe('system');
      expect(result[0].content).toContain(baseSettings.systemPrompt);
    });

    it('states the date only where it can matter', () => {
      const temporal: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'What date is today?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const webSources: SourceDocument[] = [
        { name: 'Onet', kind: 'web', url: 'https://pogoda.onet.pl/a' },
      ];

      expect(
        prepareMessagesForLLM(temporal, [], baseSettings, baseModel)[0].content
      ).toContain('CURRENT DATE');
      expect(
        prepareMessagesForLLM(
          makeMessages(2),
          ['some context'],
          baseSettings,
          baseModel,
          '',
          undefined,
          webSources
        )[0].content
      ).toContain('CURRENT DATE');
      expect(
        prepareMessagesForLLM(makeMessages(2), [], baseSettings, baseModel)[0]
          .content
      ).not.toContain('CURRENT DATE');
      expect(
        prepareMessagesForLLM(
          makeMessages(2),
          ['some context'],
          baseSettings,
          baseModel
        )[0].content
      ).not.toContain('CURRENT DATE');
    });

    it('names the answer language when the question makes it detectable', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Kto jest kanclerzem Niemiec?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const grounded = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      expect(grounded[0].content).toContain('Write the whole answer in Polish');
      const bare = prepareMessagesForLLM(messages, [], baseSettings, baseModel);
      expect(bare[0].content).toContain('Write the whole answer in Polish');
    });

    it('falls back to the generic language rule when the question is opaque', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Gdansk 2026',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        [],
        baseSettings,
        baseModel
      );
      expect(result[0].content).toContain(
        'the language of the latest user message'
      );
    });

    it('restates the detected language next to the question itself', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'pytanie po polsku',
          timestamp: 0,
        },
        {
          id: 2,
          chatId: 1,
          role: 'assistant',
          content: 'odpowiedź',
          timestamp: 0,
        },
        {
          id: 3,
          chatId: 1,
          role: 'user',
          content: 'Who is the prime minister of the UK now?',
          timestamp: 0,
        },
        { id: 4, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      expect(result.at(-1)!.content).toContain('(Answer in English.)');
    });

    it('keeps the thread language when the follow-up is too short to name one', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'jaka jest dzisiaj pogoda w Gdansku?',
          timestamp: 0,
        },
        {
          id: 2,
          chatId: 1,
          role: 'assistant',
          content: 'Dziś jest słonecznie.',
          timestamp: 0,
        },
        { id: 3, chatId: 1, role: 'user', content: 'a jutro?', timestamp: 0 },
        { id: 4, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).toContain('Write the whole answer in Polish');
      expect(result.at(-1)!.content).toContain('(Answer in Polish.)');
    });

    it('names the script and forbids transliteration for non-Latin languages', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'जर्मनी के चांसलर कौन हैं?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).toContain(
        'Write the whole answer in Hindi, written in Devanagari script'
      );
      expect(result[0].content).toContain('Never transliterate');
      expect(result.at(-1)!.content).toContain('(Answer in Hindi.)');
      expect(result.at(-1)!.content).not.toContain('Devanagari script.)');
    });

    it('anchors the language next to the question even when it cannot be named', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Gdansk 2026',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        [],
        baseSettings,
        baseModel
      );
      expect(result.at(-1)!.content).toContain(
        '(Answer in the same language as this message.)'
      );
    });

    it('tells the model to answer the question rather than summarize the pages', () => {
      const result = prepareMessagesForLLM(
        makeMessages(2),
        ['some context'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).toContain(
        'Answer the question that was asked, directly and first.'
      );
    });

    it('breaks source conflicts toward the newest reporting, but only for web context', () => {
      const withWeb = prepareMessagesForLLM(
        makeMessages(2),
        ['some context'],
        baseSettings,
        baseModel,
        '',
        undefined,
        [{ name: 'BBC', kind: 'web', url: 'https://bbc.com/a' }]
      );
      expect(withWeb[0].content).toContain(
        'trust the page reporting the newest events'
      );

      const docsOnly = prepareMessagesForLLM(
        makeMessages(2),
        ['some context'],
        baseSettings,
        baseModel,
        '',
        undefined,
        [{ name: 'notes.pdf', kind: 'document' }]
      );
      expect(docsOnly[0].content).not.toContain(
        'trust the page reporting the newest events'
      );
    });

    it('restates the recency tie-breaker next to the question for web context', () => {
      const withWeb = prepareMessagesForLLM(
        makeMessages(2),
        ['some context'],
        baseSettings,
        baseModel,
        '',
        undefined,
        [{ name: 'BBC', kind: 'web', url: 'https://bbc.com/a' }]
      );
      expect(withWeb.at(-1)!.content).toContain(
        'the one reporting the newest change'
      );

      const docsOnly = prepareMessagesForLLM(
        makeMessages(2),
        ['some context'],
        baseSettings,
        baseModel,
        '',
        undefined,
        [{ name: 'notes.pdf', kind: 'document' }]
      );
      expect(docsOnly.at(-1)!.content).not.toContain(
        'the one reporting the newest change'
      );
    });

    it('spells the week out in the language of the retrieved pages', () => {
      const messages = makeMessages(2);
      const polish = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel,
        '',
        undefined,
        [
          { name: 'Onet', kind: 'web', url: 'https://pogoda.onet.pl/a' },
          { name: 'Interia', kind: 'web', url: 'https://pogoda.interia.pl/b' },
        ]
      );
      expect(polish[0].content).toContain('Weekday names used by the pages');
      expect(polish[0].content).toMatch(
        /(poniedzia|wtorek|środa|czwartek|piątek|sobota|niedziela)/
      );
    });

    it('appends context instructions to system prompt when context is provided', () => {
      const messages = makeMessages(2);
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).toContain('You are a helpful assistant.');
      expect(result[0].content).toContain('IMPORTANT CONTEXT INFORMATION');
    });

    it('does not append context instructions when context is empty', () => {
      const messages = makeMessages(2);
      const result = prepareMessagesForLLM(
        messages,
        [],
        baseSettings,
        baseModel
      );
      expect(result[0].content).toContain(baseSettings.systemPrompt);
      expect(result[0].content).not.toContain('IMPORTANT CONTEXT INFORMATION');
    });

    it('tells the model never to say "context" to the user (F7)', () => {
      const messages = makeMessages(2);
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).toContain('Never say the word "context"');
    });

    it('warns not to guess when a needed web search came back with nothing usable', () => {
      const messages = makeMessages(2);
      const result = prepareMessagesForLLM(
        messages,
        [],
        baseSettings,
        baseModel,
        '',
        undefined,
        undefined,
        1,
        undefined,
        undefined,
        undefined,
        true
      );
      expect(result[0].content).toContain('found nothing usable');
    });

    it('does not add the failed-search warning when no search was attempted', () => {
      const messages = makeMessages(2);
      const result = prepareMessagesForLLM(
        messages,
        [],
        baseSettings,
        baseModel
      );
      expect(result[0].content).not.toContain('found nothing usable');
    });

    it('warns against citing "Source N" on a no-context follow-up after a web-grounded reply (live-found Pixel gap)', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'ile dzieci ma prezydent usa i jak nazywa się jego żona',
          timestamp: Date.now(),
        },
        {
          id: 2,
          chatId: 1,
          role: 'assistant',
          content:
            'Prezydent ma dwie córki, a jego żona nazywa się Melania Trump.',
          timestamp: Date.now(),
          sourceDocuments: [
            { name: 'Wikipedia', kind: 'web', used: true },
          ] as SourceDocument[],
        },
        {
          id: 3,
          chatId: 1,
          role: 'user',
          content: 'wypisz imiona wszystkich dzieci prezydenta',
          timestamp: Date.now(),
        },
        {
          id: 4,
          chatId: 1,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
        },
      ];
      const result = prepareMessagesForLLM(
        messages,
        [],
        baseSettings,
        baseModel
      );
      expect(result[0].content).toContain('No new search results');
      expect(result[0].content).toContain('Never write "Source 1"');
    });

    it('does not add the no-fresh-context warning when this thread never used web search', () => {
      const messages = makeMessages(2);
      const result = prepareMessagesForLLM(
        messages,
        [],
        baseSettings,
        baseModel
      );
      expect(result[0].content).not.toContain('No new search results');
    });

    it('adds current attachment priority without making it exclusive', () => {
      const messages = makeMessages(2);
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel,
        '',
        [{ documentId: 2, name: 'current.pdf' }]
      );

      expect(result[0].content).toContain('CURRENT ATTACHMENT PRIORITY');
      expect(result[0].content).toContain('current.pdf');
      expect(result[0].content).toContain(
        'You may still use earlier conversation'
      );
    });
  });

  describe('global custom system prompt', () => {
    it('appends the global custom prompt to the base system prompt', () => {
      const messages = makeMessages(2);
      const result = prepareMessagesForLLM(
        messages,
        [],
        baseSettings,
        baseModel,
        'Always answer in Polish.'
      );
      expect(result[0].content).toContain(baseSettings.systemPrompt);
      expect(result[0].content).toContain('Always answer in Polish.');
    });

    it('frames the custom prompt as silent guidance so the model does not parrot it', () => {
      const messages = makeMessages(2);
      const result = prepareMessagesForLLM(
        messages,
        [],
        baseSettings,
        baseModel,
        'Always answer in Polish.'
      );
      expect(result[0].content).toMatch(/silently/i);
      expect(result[0].content).toMatch(/never mention/i);
      expect(result[0].content.indexOf('silently')).toBeLessThan(
        result[0].content.indexOf('Always answer in Polish.')
      );
    });

    it('keeps the base prompt unchanged when the global prompt is empty or whitespace', () => {
      const messages = makeMessages(2);
      const emptyResult = prepareMessagesForLLM(
        messages,
        [],
        baseSettings,
        baseModel,
        ''
      );
      const whitespaceResult = prepareMessagesForLLM(
        messages,
        [],
        baseSettings,
        baseModel,
        '   \n  '
      );
      expect(emptyResult[0].content).toContain(baseSettings.systemPrompt);
      expect(whitespaceResult[0].content).toContain(baseSettings.systemPrompt);
      expect(emptyResult[0].content).toBe(whitespaceResult[0].content);
    });

    it('uses the global prompt alone when the base system prompt is empty', () => {
      const messages = makeMessages(2);
      const result = prepareMessagesForLLM(
        messages,
        [],
        { ...baseSettings, systemPrompt: '' },
        baseModel,
        'Be concise.'
      );
      expect(result[0].content).toContain('Be concise.');
    });

    it('preserves the RAG grounding instructions alongside the global prompt', () => {
      const messages = makeMessages(2);
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel,
        'Always answer in Polish.'
      );
      expect(result[0].content).toContain('You are a helpful assistant.');
      expect(result[0].content).toContain('Always answer in Polish.');
      expect(result[0].content).toContain('IMPORTANT CONTEXT INFORMATION');
    });
  });

  describe('context described by source kind', () => {
    const web = [
      { name: 'Oil prices', kind: 'web' as const, url: 'https://a.example/' },
    ];
    const doc = [{ documentId: 1, name: 'report.pdf' }];

    it('calls them web pages when the context came only from a search', () => {
      const result = prepareMessagesForLLM(
        makeMessages(2),
        ['some context'],
        baseSettings,
        baseModel,
        '',
        undefined,
        web
      );
      expect(result[0].content).toContain('web pages');
      expect(result[0].content).toContain('search results');
      expect(result[0].content).not.toContain("the user's documents");
      expect(result[0].content).not.toContain('"I don\'t know"');
      expect(result[0].content).not.toContain('Do not answer about any');
    });

    it('keeps the document wording for local sources', () => {
      const result = prepareMessagesForLLM(
        makeMessages(2),
        ['some context'],
        baseSettings,
        baseModel,
        '',
        undefined,
        doc
      );
      expect(result[0].content).toContain("the user's documents");
      expect(result[0].content).not.toContain('web pages');
    });

    it('names both when a turn mixes documents and web results', () => {
      const result = prepareMessagesForLLM(
        makeMessages(2),
        ['some context'],
        baseSettings,
        baseModel,
        '',
        undefined,
        [...doc, ...web]
      );
      expect(result[0].content).toContain("the user's documents");
      expect(result[0].content).toContain('web pages');
      expect(result[0].content).toContain('Do not answer about any document');
    });

    it('falls back to the document wording when no sources are recorded', () => {
      const result = prepareMessagesForLLM(
        makeMessages(2),
        ['some context'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).toContain("the user's documents");
    });

    it('mentions the (Overview) marker only when an attachment is present', () => {
      const withAttachment = prepareMessagesForLLM(
        makeMessages(2),
        ['some context'],
        baseSettings,
        baseModel,
        '',
        doc,
        doc
      );
      const withoutAttachment = prepareMessagesForLLM(
        makeMessages(2),
        ['some context'],
        baseSettings,
        baseModel,
        '',
        undefined,
        doc
      );
      expect(withAttachment[0].content).toContain('(Overview)');
      expect(withoutAttachment[0].content).not.toContain('(Overview)');
    });
  });

  describe('falling back beyond the context block', () => {
    const web = [
      { name: 'Oil prices', kind: 'web' as const, url: 'https://a.example/' },
    ];
    const doc = [{ documentId: 1, name: 'report.pdf' }];

    const render = (sources?: SourceDocument[]) =>
      String(
        prepareMessagesForLLM(
          makeMessages(2),
          ['some context'],
          baseSettings,
          baseModel,
          '',
          undefined,
          sources
        )[0].content
      );

    it.each([
      ['documents', doc, 'the sources contain no information'],
      ['web results', web, 'the search results contain no information'],
      ['a mix', [...doc, ...web], 'the sources contain no information'],
    ])('states what is missing before allowing %s', (_label, sources, said) => {
      const content = render(sources as SourceDocument[]);
      expect(content).toContain(said);
      expect(content.indexOf(said)).toBeLessThan(
        content.indexOf('only then may you add what you know')
      );
    });

    it('requires the model to mark its own knowledge as such', () => {
      expect(render(doc)).toContain('marked as your own knowledge');
    });

    it('phrases the refusal so citation suppression recognises it', () => {
      expect(looksLikeNoAnswer(render(doc))).toBe(true);
      expect(looksLikeNoAnswer(render(web))).toBe(true);
    });

    it('states why an absent document cannot be answered about', () => {
      expect(render(doc)).toContain('its text is not available to you');
    });
  });

  describe('event message filtering', () => {
    it('strips event messages from the output', () => {
      const messages: Message[] = [
        { id: 1, chatId: 1, role: 'user', content: 'hello', timestamp: 0 },
        {
          id: 2,
          chatId: 1,
          role: 'event',
          content: 'System: file added',
          timestamp: 0,
        },
        {
          id: 3,
          chatId: 1,
          role: 'assistant',
          content: 'hi there',
          timestamp: 0,
        },
        { id: 4, chatId: 1, role: 'assistant', content: '', timestamp: 0 }, // placeholder
      ];
      const result = prepareMessagesForLLM(
        messages,
        [],
        baseSettings,
        baseModel
      );
      const roles = result.map((m) => m.role);
      expect(roles).not.toContain('event');
      expect(result).toHaveLength(3);
    });
  });

  describe('message history', () => {
    it('includes all non-event messages regardless of count', () => {
      const messages = makeMessages(20);
      const result = prepareMessagesForLLM(
        messages,
        [],
        baseSettings,
        baseModel
      );
      expect(result).toHaveLength(21);
      expect(result[0].role).toBe('system');
    });

    it('handles empty message list', () => {
      const result = prepareMessagesForLLM([], [], baseSettings, baseModel);
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('system');
    });
  });

  describe('thinking tokens', () => {
    it('appends /think to last message when thinkingEnabled is true', () => {
      const messages = makeMessages(3);
      const settings = { ...baseSettings, thinkingEnabled: true };
      const result = prepareMessagesForLLM(messages, [], settings, baseModel);
      const last = result[result.length - 1];
      expect(last.content).toContain('/think');
    });

    it('appends /no_think when model supports thinking but thinkingEnabled is false', () => {
      const messages = makeMessages(3);
      const thinkingModel = { ...baseModel, thinking: true };
      const result = prepareMessagesForLLM(
        messages,
        [],
        baseSettings,
        thinkingModel
      );
      const last = result[result.length - 1];
      expect(last.content).toContain('/no_think');
    });

    it('does not append any token when neither thinkingEnabled nor model.thinking', () => {
      const messages = makeMessages(3);
      const result = prepareMessagesForLLM(
        messages,
        [],
        baseSettings,
        baseModel
      );
      const last = result[result.length - 1];
      expect(last.content).not.toContain('/think');
      expect(last.content).not.toContain('/no_think');
    });

    it('prefers /think over /no_think when thinkingEnabled=true and model.thinking=true', () => {
      const messages = makeMessages(3);
      const thinkingModel = { ...baseModel, thinking: true };
      const settings = { ...baseSettings, thinkingEnabled: true };
      const result = prepareMessagesForLLM(
        messages,
        [],
        settings,
        thinkingModel
      );
      const last = result[result.length - 1];
      expect(last.content).toContain('/think');
      expect(last.content).not.toContain('/no_think');
    });
  });

  describe('context injection', () => {
    it('wraps context in <context> tags on the latest user message', () => {
      const messages = makeMessages(3);
      const result = prepareMessagesForLLM(
        messages,
        ['chunk one', 'chunk two'],
        baseSettings,
        baseModel
      );
      const last = result[result.length - 1];
      expect(last.role).toBe('user');
      expect(last.content).toContain('<context>chunk one chunk two</context>');
      expect(last.content).toContain('message 3');
    });

    it('removes the assistant placeholder before adding context', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'What is RAG?',
          timestamp: 0,
        },
        {
          id: 2,
          chatId: 1,
          role: 'assistant',
          content: 'answer',
          timestamp: 0,
        },
        {
          id: 3,
          chatId: 1,
          role: 'user',
          content: 'Tell me more',
          timestamp: 0,
        },
        { id: 4, chatId: 1, role: 'assistant', content: '', timestamp: 0 }, // placeholder
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      const last = result[result.length - 1];
      expect(result).toHaveLength(4);
      expect(last.role).toBe('user');
      expect(last.content).toContain('Tell me more');
      expect(last.content).toContain('<context>some context</context>');
    });

    it('adds a grounding reminder next to the question when an attachment is present', () => {
      const messages = makeMessages(3);
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel,
        '',
        [{ documentId: 2, name: 'current.pdf' }]
      );
      const last = result[result.length - 1];
      expect(last.content).toMatch(/about the just-attached document/i);
    });

    it('omits the grounding reminder when there is no attachment', () => {
      const messages = makeMessages(3);
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      const last = result[result.length - 1];
      expect(last.content).not.toMatch(/about the just-attached document/i);
    });

    it('restates the web-search intent next to the question', () => {
      const messages = makeMessages(3);
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel,
        '',
        undefined,
        undefined,
        1,
        'current Kraków weather'
      );
      const last = result[result.length - 1];
      expect(last.content).toContain(
        'Question intent: current Kraków weather.'
      );
    });

    it('lists every sub-question when the plan had more than one query', () => {
      const messages = makeMessages(3);
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel,
        '',
        undefined,
        undefined,
        1,
        'compare two phones',
        ['iPhone 16 price', 'Galaxy S24 price']
      );
      const last = result[result.length - 1];
      expect(last.content).toContain('answer every one of them');
      expect(last.content).toContain('(1) iPhone 16 price');
      expect(last.content).toContain('(2) Galaxy S24 price');
    });

    it('omits the intent line when no web search plan was produced', () => {
      const messages = makeMessages(3);
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      const last = result[result.length - 1];
      expect(last.content).not.toContain('Question intent:');
    });

    it('asks for a grounded opinion when the question requests one', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Co sądzisz o najnowszym iPhonie?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const webSources: SourceDocument[] = [
        { name: 'Apple', kind: 'web', url: 'https://apple.com/iphone' },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['iPhone 17: 48MP camera, A19 chip, ProMotion display'],
        baseSettings,
        baseModel,
        '',
        undefined,
        webSources
      );
      expect(result[0].content).toContain('asks for your assessment');
    });

    it('does not nudge for an opinion on a plain factual question', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'What is the price of the new iPhone?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).not.toContain('asks for your assessment');
    });

    it('nudges toward comparing returns, not price level, on an investment comparison question', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content:
            'Porownaj bitcoina i ethereum i powiedz ktory byl lepsza inwestycja',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).toContain('percentage change (return)');
    });

    it('does not nudge on investment reasoning for an unrelated factual question', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'What is the price of the new iPhone?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).not.toContain('percentage change (return)');
    });

    it('nudges toward a structured comparison on a "how do X and Y differ" question (F18)', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Czym się różnią objawy grypy i przeziębienia?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).toContain('stay visibly separate');
    });

    it('nudges toward a structured comparison on a "compare X and Y" question without "vs"/"differ" (F26)', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content:
            'Compare the current prices of Bitcoin, Ethereum and Solana.',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).toContain('stay visibly separate');
    });

    it('does not nudge the comparison structure on a single-subject question', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Jakie są objawy grypy?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).not.toContain('stay visibly separate');
    });

    it('asks for the opponent/date on a "last match" question, not just the score (F19)', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Jaki był wynik ostatniego meczu Realu Madryt?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).toContain('who else was involved');
    });

    it('does not nudge recent-event completeness on a season-total question', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'How many points has LeBron James scored this season?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).not.toContain('who else was involved');
    });

    it('nudges toward using the prior figure on a follow-up conversion question (F21)', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'What is the current price of gold per ounce?',
          timestamp: 0,
        },
        {
          id: 2,
          chatId: 1,
          role: 'assistant',
          content: 'The current price of gold per ounce is $1573.',
          timestamp: 0,
        },
        {
          id: 3,
          chatId: 1,
          role: 'user',
          content: 'And how much is that in euros?',
          timestamp: 0,
        },
        { id: 4, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).toContain('own previous answer');
    });

    it('does not nudge follow-up conversion on an unrelated question', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'What is the current price of gold per ounce?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).not.toContain('own previous answer');
    });

    it('warns that a source is speculative when its title says so', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Jaki jest najnowszy model iPhone?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const webSources: SourceDocument[] = [
        {
          name: 'iPhone 18: Rumors and Release Date',
          kind: 'web',
          url: 'https://macrumors.com/iphone18',
        },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['iPhone 18 is expected to launch in September.'],
        baseSettings,
        baseModel,
        '',
        undefined,
        webSources
      );
      expect(result[0].content).toContain('rumor or speculation');
    });

    it('does not warn about speculation when no source title signals it', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Jaki jest najnowszy model iPhone?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const webSources: SourceDocument[] = [
        {
          name: 'Apple - iPhone',
          kind: 'web',
          url: 'https://apple.com/iphone',
        },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['The iPhone 17 launched in September 2025.'],
        baseSettings,
        baseModel,
        '',
        undefined,
        webSources
      );
      expect(result[0].content).not.toContain('rumor or speculation');
    });

    it('warns to match the exact storage variant when the question names one', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content:
            'Jaka jest aktualna cena iPhone 17 Pro 256GB w Polsce i czy jest teraz jakas promocja?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['iPhone 17 Pro 256GB - 5189 zl. iPhone Air 1TB - 5299 zl.'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).toContain('256GB variant');
    });

    it('does not nudge on variant matching when the question names no capacity', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Jaka jest aktualna cena iPhone 17 Pro w Polsce?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).not.toContain('variant');
    });

    it('warns not to use an all-time figure to answer a this-year "most" question', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content:
            'Kto zdobyl najwiecej bramek w reprezentacji Polski w pilce noznej w tym roku i w jakich meczach',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['Lewandowski - 89 goals, all-time record scorer.'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).toContain('all-time or career total');
    });

    it('does not nudge the period-scope guard on a plain "most" question with no time window', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content:
            'Kto zdobyl najwiecej bramek w reprezentacji Polski w pilce noznej',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).not.toContain('all-time or career total');
    });

    it('always warns to check a source figure against a narrower scope when context is present (F6)', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Ile bramek w lidze strzelil Lewandowski w tym sezonie?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['Lewandowski - 5 goals in the Champions League this season.'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).toContain('narrower scope');
    });

    it('does not nudge the period-scope guard on a this-year question with no superlative', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Ile bramek strzelil Lewandowski w tym roku?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).not.toContain('all-time or career total');
    });

    it('warns to admit a gap rather than pad out a thin answer when retrieval came back weak', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'What ingredients should not be combined in skincare?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['some thin context'],
        baseSettings,
        baseModel,
        '',
        undefined,
        undefined,
        1,
        undefined,
        undefined,
        true
      );
      expect(result[0].content).toContain('could not be confidently verified');
    });

    it('does not add the weak-retrieval warning when retrieval was not flagged weak', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'What ingredients should not be combined in skincare?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).not.toContain(
        'could not be confidently verified'
      );
    });

    it('tells the model to admit missing data on a trend question with only a current price in context', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content:
            'Czy to dobry moment zeby kupic, biorac pod uwage zmiane z ostatniego miesiaca?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['Ethereum price today: $1,910.95'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).toContain('do not infer a trend');
    });

    it('does not nudge the trend guard when the context already has change data', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Ktory zyskal wiecej procentowo w tym miesiacu?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['Ethereum is up 12% this month, Bitcoin is up 4%.'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).not.toContain('do not infer a trend');
    });

    it('still nudges the trend guard when context only has unrelated 24h/hourly change noise', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Ktory zyskal wiecej procentowo w tym miesiacu?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        [
          'Bitcoin price today: $64,146.36, an increase of 0.33% in the last hour and 1.13% in the last 24 hours.',
        ],
        baseSettings,
        baseModel
      );
      expect(result[0].content).toContain('do not infer a trend');
    });

    it('does not nudge the trend guard on an unrelated factual question', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'What is the price of the new iPhone?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['iPhone 17 price: $999'],
        baseSettings,
        baseModel
      );
      expect(result[0].content).not.toContain('do not infer a trend');
    });

    it('reminds the model to keep the question language against foreign-language web sources', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Jaka jest teraz pogoda w Warszawie?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const webSources: SourceDocument[] = [
        { name: 'Weather', kind: 'web', url: 'https://weather.example/warsaw' },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['Warsaw weather: sunny, 20C'],
        baseSettings,
        baseModel,
        '',
        undefined,
        webSources
      );
      const last = result[result.length - 1];
      expect(last.content).toContain("Answer in Polish, not the sources'");
    });

    it('falls back to a language-agnostic reminder when the question language is undetected', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: '123 456',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const webSources: SourceDocument[] = [
        { name: 'Weather', kind: 'web', url: 'https://weather.example/warsaw' },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel,
        '',
        undefined,
        webSources
      );
      const last = result[result.length - 1];
      expect(last.content).toContain(
        "Answer in the user's language, not the sources'"
      );
    });

    it('lists the currency figures found in web context as a whitelist', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Ile kosztuje teraz ethereum?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const webSources: SourceDocument[] = [
        { name: 'Crypto', kind: 'web', url: 'https://crypto.example/eth' },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['Ethereum Price: $1,901.25 (0.20%) | ETH'],
        baseSettings,
        baseModel,
        '',
        undefined,
        webSources
      );
      const last = result[result.length - 1];
      expect(last.content).toContain('Figures found in the sources: $1,901.25');
      expect(last.content).toContain('never one from memory');
    });

    it('whitelists only the figure a "price" sentence governs, not nearby unrelated numbers', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Ile kosztuje teraz ethereum?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const webSources: SourceDocument[] = [
        { name: 'Crypto', kind: 'web', url: 'https://crypto.example/eth' },
      ];
      const result = prepareMessagesForLLM(
        messages,
        [
          '91952 ETH, or $6960 in Ethereum price today. The live Ethereum price today is $1,913.14 USD.',
        ],
        baseSettings,
        baseModel,
        '',
        undefined,
        webSources
      );
      const last = result[result.length - 1];
      const whitelistLine = last.content
        .split('\n')
        .find((line) => line.startsWith('Figures found in the sources'));
      expect(whitelistLine).toBe(
        'Figures found in the sources: $1,913.14. State a price or amount only if it matches one of these — never one from memory.'
      );
    });

    it('nudges toward a range instead of a raw list when a listing page has 3+ valid prices (F14)', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Ile kosztuja buty Nike Air Max 90?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const webSources: SourceDocument[] = [
        { name: 'Nike', kind: 'web', url: 'https://nike.com/air-max-90' },
      ];
      const result = prepareMessagesForLLM(
        messages,
        [
          'Air Max 90 $145. Air Max 90 SE $108.97. Air Max 90 Premium $160. Air Max 90 Futura $65.',
        ],
        baseSettings,
        baseModel,
        '',
        undefined,
        webSources
      );
      const last = result[result.length - 1];
      const whitelistLine = last.content
        .split('\n')
        .find((line) => line.startsWith('Figures found in the sources'));
      expect(whitelistLine).toContain('do not list them out');
      expect(whitelistLine).toContain('ONLY a range');
    });

    it('does not add the range nudge for just two figures (e.g. current vs. previous price)', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Ile kosztuje ten telefon?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const webSources: SourceDocument[] = [
        { name: 'Shop', kind: 'web', url: 'https://shop.example/phone' },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['Cena: 999 zł (poprzednio 1299 zł).'],
        baseSettings,
        baseModel,
        '',
        undefined,
        webSources
      );
      const last = result[result.length - 1];
      const whitelistLine = last.content
        .split('\n')
        .find((line) => line.startsWith('Figures found in the sources'));
      expect(whitelistLine).not.toContain('do not list them out');
    });

    it('flags a price figure far below the others as a likely outlier, not a real low price (F15)', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Ile kosztuje karta graficzna RTX 4070?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const webSources: SourceDocument[] = [
        { name: 'Allegro', kind: 'web', url: 'https://allegro.pl/rtx-4070' },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['RTX 4070: 399 zł, 2199 zł, 2349 zł, 2599 zł widoczne w ofertach.'],
        baseSettings,
        baseModel,
        '',
        undefined,
        webSources
      );
      const last = result[result.length - 1];
      const whitelistLine = last.content
        .split('\n')
        .find((line) => line.startsWith('Figures found in the sources'));
      expect(whitelistLine).toContain('399 zł');
      expect(whitelistLine).toContain('far apart from the other figures');
      expect(whitelistLine).toContain('Do not use it as the low');
    });

    it('flags a lone "price statement" match as an outlier against the page\'s other figures (F25)', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'What is the current price of gold per ounce?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const webSources: SourceDocument[] = [
        { name: 'Gold', kind: 'web', url: 'https://livepriceofgold.com' },
      ];
      const result = prepareMessagesForLLM(
        messages,
        [
          'Investing.com shows gold price $0.1670 today. Other trackers report: $2031.50, $2029.80, $2033.10.',
        ],
        baseSettings,
        baseModel,
        '',
        undefined,
        webSources
      );
      const last = result[result.length - 1];
      const whitelistLine = last.content
        .split('\n')
        .find((line) => line.startsWith('Figures found in the sources'));
      expect(whitelistLine).toContain('$0.1670');
      expect(whitelistLine).toContain('far apart from the other figures');
    });

    it('does not flag any figure as an outlier when prices cluster normally', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Ile kosztuja buty Nike Air Max 90?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const webSources: SourceDocument[] = [
        { name: 'Nike', kind: 'web', url: 'https://nike.com/air-max-90' },
      ];
      const result = prepareMessagesForLLM(
        messages,
        [
          'Air Max 90 $145. Air Max 90 SE $108.97. Air Max 90 Premium $160. Air Max 90 Futura $65.',
        ],
        baseSettings,
        baseModel,
        '',
        undefined,
        webSources
      );
      const last = result[result.length - 1];
      const whitelistLine = last.content
        .split('\n')
        .find((line) => line.startsWith('Figures found in the sources'));
      expect(whitelistLine).not.toContain('far apart from the other figures');
    });

    it('tells the model to trust a "[Verified product data]" block over other figures (F16)', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Ile kosztuje karta RTX 4070?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const webSources: SourceDocument[] = [
        { name: 'Allegro', kind: 'web', url: 'https://allegro.pl/rtx-4070' },
      ];
      const result = prepareMessagesForLLM(
        messages,
        [
          '[Verified product data] name="RTX 4070", price=2199 PLN\nOther decoy prices mentioned nearby: 399 zł.',
        ],
        baseSettings,
        baseModel,
        '',
        undefined,
        webSources
      );
      expect(result[0].content).toContain('[Verified product data]');
      expect(result[0].content).toContain(
        'not text scraped and inferred like the rest of the passage'
      );
    });

    it('does not add the verified-product instruction when no source carries structured data', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Ile kosztuje karta RTX 4070?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const webSources: SourceDocument[] = [
        { name: 'Allegro', kind: 'web', url: 'https://allegro.pl/rtx-4070' },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['Karty graficzne w cenach od 399 zł do 2599 zł.'],
        baseSettings,
        baseModel,
        '',
        undefined,
        webSources
      );
      expect(result[0].content).not.toContain(
        'not text scraped and inferred like the rest of the passage'
      );
    });

    it('omits the figures whitelist when the web context has no currency figures', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Jaka jest pogoda w Warszawie?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const webSources: SourceDocument[] = [
        { name: 'Weather', kind: 'web', url: 'https://weather.example/warsaw' },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['Sunny, 20C today.'],
        baseSettings,
        baseModel,
        '',
        undefined,
        webSources
      );
      const last = result[result.length - 1];
      expect(last.content).not.toContain('Figures found in the sources');
    });

    it('groups the figures whitelist per entity when sources are tagged by query', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Porownaj cene bitcoina i ethereum',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const webSources: SourceDocument[] = [
        { name: 'BTC', kind: 'web', url: 'https://a.example/btc' },
        { name: 'ETH', kind: 'web', url: 'https://b.example/eth' },
      ];
      const result = prepareMessagesForLLM(
        messages,
        [
          '[Answers: bitcoin price today]\nBitcoin price today: $64,146.36',
          '[Answers: ethereum price today]\nEthereum Price: $1,898.04',
        ],
        baseSettings,
        baseModel,
        '',
        undefined,
        webSources
      );
      const last = result[result.length - 1];
      expect(last.content).toContain('Figures found per entity');
      expect(last.content).toContain('bitcoin price today → $64,146.36');
      expect(last.content).toContain('ethereum price today → $1,898.04');
      expect(last.content).toContain('never for another entity');
    });

    it('tells the model to admit missing data for an entity absent from the per-entity figures list (F27)', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content:
            'Compare the current prices of Bitcoin, Ethereum and Solana.',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const webSources: SourceDocument[] = [
        { name: 'BTC', kind: 'web', url: 'https://a.example/btc' },
        { name: 'ETH', kind: 'web', url: 'https://b.example/eth' },
      ];
      const result = prepareMessagesForLLM(
        messages,
        [
          '[Answers: bitcoin price today]\nBitcoin price today: $64,146.36',
          '[Answers: ethereum price today]\nEthereum Price: $1,898.04',
        ],
        baseSettings,
        baseModel,
        '',
        undefined,
        webSources
      );
      const last = result[result.length - 1];
      expect(last.content).toContain('no entry in this list');
    });

    it('warns the model against inventing a figure for something absent from the context entirely (F27)', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'What is the current price of gold?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const webSources: SourceDocument[] = [
        { name: 'Gold', kind: 'web', url: 'https://a.example/gold' },
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['Gold price today: $4,512.10 per ounce.'],
        baseSettings,
        baseModel,
        '',
        undefined,
        webSources
      );
      expect(result[0].content).toContain(
        'not mentioned anywhere in the context'
      );
    });

    it('omits the language reminder when there is no web source', () => {
      const messages = makeMessages(3);
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      const last = result[result.length - 1];
      expect(last.content).not.toContain("not the sources'");
    });

    it('combines context and /think token', () => {
      const messages = makeMessages(3);
      const settings = { ...baseSettings, thinkingEnabled: true };
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        settings,
        baseModel
      );
      const last = result[result.length - 1];
      expect(last.role).toBe('user');
      expect(last.content).toContain('/think');
      expect(last.content).toContain('<context>');
    });
  });

  describe('context window budget', () => {
    const bigMessage = (id: number, role: Message['role']): Message => ({
      id,
      chatId: 1,
      role,
      content: 'x'.repeat(getPromptCharBudget(baseModel)),
      timestamp: 0,
    });

    it('drops the oldest history messages when the prompt overflows', () => {
      const history: Message[] = Array.from({ length: 10 }, (_, i) =>
        bigMessage(i + 1, i % 2 === 0 ? 'user' : 'assistant')
      );
      const messages: Message[] = [
        ...history,
        {
          id: 11,
          chatId: 1,
          role: 'user',
          content: 'latest question',
          timestamp: 0,
        },
        { id: 12, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];

      const result = prepareMessagesForLLM(
        messages,
        [],
        baseSettings,
        baseModel
      );

      expect(result[0].role).toBe('system');
      expect(result[result.length - 1].content).toContain('latest question');
      expect(result.length).toBeLessThan(messages.length);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('always keeps the system prompt and the latest question', () => {
      const history: Message[] = Array.from({ length: 20 }, (_, i) =>
        bigMessage(i + 1, i % 2 === 0 ? 'user' : 'assistant')
      );
      const messages: Message[] = [
        ...history,
        { id: 21, chatId: 1, role: 'user', content: 'keep me', timestamp: 0 },
        { id: 22, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];

      const result = prepareMessagesForLLM(
        messages,
        [],
        baseSettings,
        baseModel
      );

      expect(result[0].role).toBe('system');
      const last = result[result.length - 1];
      expect(last.role).toBe('user');
      expect(last.content).toContain('keep me');
    });

    it('keeps the assembled prompt within budget when doc and web context overflow', () => {
      const budget = getPromptCharBudget(baseModel);
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'question about the topic',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const docBlock = sourceBlock(0, 'doc.pdf', 'd'.repeat(budget));
      const webBlock = sourceBlock(1, 'Web Page', 'w'.repeat(budget));

      const result = prepareMessagesForLLM(
        messages,
        [docBlock, webBlock],
        baseSettings,
        baseModel,
        '',
        undefined,
        [
          { name: 'doc.pdf' },
          { name: 'Web Page', kind: 'web', url: 'https://x.com' },
        ] as SourceDocument[]
      );

      const assembled = result
        .map((msg) => (typeof msg.content === 'string' ? msg.content : ''))
        .join(' ');
      const total = result.reduce(
        (sum, msg) =>
          sum + (typeof msg.content === 'string' ? msg.content.length : 0),
        0
      );
      expect(total).toBeLessThanOrEqual(
        getPromptCharBudget(baseModel, assembled)
      );
    });

    it('truncates the RAG context when it alone overflows the budget', () => {
      const messages: Message[] = [
        { id: 1, chatId: 1, role: 'user', content: 'question', timestamp: 0 },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const hugeContext = 'y'.repeat(
        getPromptCharBudget(baseModel) * 2 + 10000
      );

      const result = prepareMessagesForLLM(
        messages,
        [hugeContext],
        baseSettings,
        baseModel
      );

      const last = result[result.length - 1];
      expect(last.content).toContain('question');
      expect(last.content).toContain('<context>');
      expect(last.content.length).toBeLessThan(hugeContext.length);
    });

    it('cuts an over-budget context at a chunk boundary, keeping the leading section', () => {
      const messages: Message[] = [
        { id: 1, chatId: 1, role: 'user', content: 'question', timestamp: 0 },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const answer = 'NEEDLE_ANSWER_XYZ is the answer.';
      const filler = 'FILLERBLOCK'.repeat(3000);
      const context = [`${answer}\n\n${filler}`];

      const result = prepareMessagesForLLM(
        messages,
        context,
        baseSettings,
        baseModel
      );

      const last = result[result.length - 1];
      expect(last.content).toContain('NEEDLE_ANSWER_XYZ');
      expect(last.content).not.toContain('FILLERBLOCK');
    });

    it('never whitelists a price figure that truncation cut out of the context (F9)', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Ile kosztuje iPhone 17 Pro?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const webSources: SourceDocument[] = [
        { name: 'Ceneo', kind: 'web', url: 'https://ceneo.example/iphone' },
      ];
      const filler = 'FILLERBLOCK'.repeat(3000);
      const context = [`Cena: $5,147.00\n\n${filler}\n\nCena: $3,746.00`];

      const result = prepareMessagesForLLM(
        messages,
        context,
        baseSettings,
        baseModel,
        '',
        undefined,
        webSources
      );

      const last = result[result.length - 1];
      expect(last.content).not.toContain('FILLERBLOCK');
      const whitelistLine = last.content
        .split('\n')
        .find((line) => line.startsWith('Figures found in the sources'));
      expect(whitelistLine).toContain('$5,147.00');
      expect(whitelistLine).not.toContain('$3,746.00');
    });

    it('keeps the queried product\'s own price when a "related products" carousel of decoy prices comes first on the same source page (F11)', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Ile kosztuje iPhone 17 Pro 256GB w Polsce?',
          timestamp: 0,
        },
        { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];
      const webSources: SourceDocument[] = [
        { name: 'Ceneo', kind: 'web', url: 'https://ceneo.example/iphone' },
      ];
      const carousel = Array.from(
        { length: Math.ceil(getPromptCharBudget(baseModel) / 45) },
        (_, i) => `Apple iPhone Air 256GB Kolor${i} od 3 6${i % 10}9,00 zl.`
      ).join(' ');
      const context = [
        `\n --- Source 1: Apple iPhone 17 Pro 256GB Glebinowy blekit - Ceneo.pl --- \n ${carousel} Apple iPhone 17 Pro 256GB Glebinowy blekit od 5 099,00 zl. \n --- End of Source 1 ---`,
      ];

      const result = prepareMessagesForLLM(
        messages,
        context,
        baseSettings,
        baseModel,
        '',
        undefined,
        webSources
      );

      const last = result[result.length - 1];
      expect(last.content).toContain('5 099');
      expect(last.content).toContain('--- Source 1:');
      expect(last.content).toContain('--- End of Source 1 ---');
    });

    it('does not trim when everything comfortably fits', () => {
      const messages = makeMessages(6);
      const result = prepareMessagesForLLM(
        messages,
        ['small context'],
        baseSettings,
        baseModel
      );
      expect(result).toHaveLength(7);
    });

    it('drops a leading assistant reply when trimming splits a pair', () => {
      const messages: Message[] = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'u'.repeat(getPromptCharBudget(baseModel) * 2),
          timestamp: 0,
        },
        {
          id: 2,
          chatId: 1,
          role: 'assistant',
          content: 'short reply',
          timestamp: 0,
        },
        {
          id: 3,
          chatId: 1,
          role: 'user',
          content: 'final question',
          timestamp: 0,
        },
        { id: 4, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
      ];

      const result = prepareMessagesForLLM(
        messages,
        [],
        baseSettings,
        baseModel
      );

      expect(result.slice(1).map((m) => m.role)).toEqual(['user']);
      expect(result.at(-1)!.content).toContain('final question');
    });

    it('closes the last source block when truncation cuts inside it', () => {
      const passage = 'x'.repeat(getPromptCharBudget(baseModel) * 2);
      const block = `\n --- Source 1: big.pdf --- \n ${passage} \n --- End of Source 1 ---`;

      const result = prepareMessagesForLLM(
        [
          { id: 1, chatId: 1, role: 'user', content: 'question', timestamp: 0 },
          { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
        ],
        [block],
        baseSettings,
        baseModel
      );

      const last = String(result.at(-1)!.content);
      expect(last).toContain('--- Source 1: big.pdf ---');
      expect(last).toContain('--- End of Source 1 ---');
      expect(last.length).toBeLessThan(block.length);
    });

    it('closes a truncated attachment-overview block too', () => {
      const passage = 'x'.repeat(getPromptCharBudget(baseModel) * 2);
      const block = `\n --- Current Attachment Source: a.pdf (Overview) --- \n ${passage} \n --- End of Current Attachment Source ---`;

      const result = prepareMessagesForLLM(
        [
          { id: 1, chatId: 1, role: 'user', content: 'question', timestamp: 0 },
          { id: 2, chatId: 1, role: 'assistant', content: '', timestamp: 0 },
        ],
        [block],
        baseSettings,
        baseModel
      );

      const last = String(result.at(-1)!.content);
      expect(last).toContain('--- Current Attachment Source: a.pdf');
      expect(last).toContain('--- End of Current Attachment Source ---');
    });
  });

  describe('prompt assembly hygiene', () => {
    it('neutralizes context tags inside retrieved content', () => {
      const result = prepareMessagesForLLM(
        makeMessages(2),
        ['before <CONTEXT>injected</ context > after'],
        baseSettings,
        baseModel
      );
      const last = String(result.at(-1)!.content);
      expect(last.match(/<[^>]*context[^>]*>/gi)).toHaveLength(2);
      expect(last).toContain('<context>before injected after</context>');
    });

    it('keeps the wrapped question flush on its own line', () => {
      const result = prepareMessagesForLLM(
        makeMessages(2),
        ['ctx'],
        baseSettings,
        baseModel
      );
      expect(String(result.at(-1)!.content)).toBe(
        '<context>ctx</context>\nmessage 2 (Answer in the same language as this message.)'
      );
    });

    it('treats whitespace-only context as no context at all', () => {
      const result = prepareMessagesForLLM(
        makeMessages(2),
        ['   '],
        baseSettings,
        baseModel
      );
      expect(result[0].content).not.toContain('IMPORTANT CONTEXT INFORMATION');
      expect(String(result.at(-1)!.content)).not.toContain('<context>');
    });
  });
});

describe('getPromptCharBudget script awareness', () => {
  const english = 'plain ascii english text about concert tickets '.repeat(40);
  const polish =
    'Czy są jeszcze dostępne miejsca na festiwalu? Wstępna sprzedaż wejściówek ruszyła we wrześniu, a organizatorzy zapowiedzieli dodatkową pulę biletów. '.repeat(
      12
    );
  const cjk = '東京で開催される音楽フェスティバルのチケット情報。'.repeat(60);

  it('never drops below the default budget for ascii text', () => {
    expect(getPromptCharBudget(baseModel, english)).toBeGreaterThanOrEqual(
      getPromptCharBudget(baseModel)
    );
  });

  it('shrinks the char budget for diacritic-heavy text', () => {
    expect(getPromptCharBudget(baseModel, polish)).toBeLessThan(
      getPromptCharBudget(baseModel, english)
    );
  });

  it('shrinks it further for CJK text', () => {
    expect(getPromptCharBudget(baseModel, cjk)).toBeLessThan(
      getPromptCharBudget(baseModel, polish)
    );
  });
});

describe('prepareMessagesForLLM budget scale', () => {
  it('keeps less history when the budget is scaled down for a retry', () => {
    const messages: Message[] = [
      ...Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        chatId: 1,
        role: (i % 2 === 0 ? 'user' : 'assistant') as Message['role'],
        content: `turn ${i + 1} ${'padding words here '.repeat(20)}`,
        timestamp: Date.now(),
      })),
      {
        id: 99,
        chatId: 1,
        role: 'assistant' as Message['role'],
        content: '',
        timestamp: Date.now(),
      },
    ];

    const full = prepareMessagesForLLM(messages, [], baseSettings, baseModel);
    const half = prepareMessagesForLLM(
      messages,
      [],
      baseSettings,
      baseModel,
      '',
      undefined,
      undefined,
      0.5
    );

    expect(half.length).toBeLessThan(full.length);
    expect(half[0].role).toBe('system');
    expect(half.at(-1)!.content).toBe(full.at(-1)!.content);
  });
});
