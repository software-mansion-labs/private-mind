import { prepareMessagesForLLM } from '../utils/promptUtils';
import { looksLikeNoAnswer } from '../utils/messageSources';
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
  // trailing assistant placeholder (always present in real usage)
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
      expect(result[0]).toEqual({
        role: 'system',
        content: baseSettings.systemPrompt,
      });
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
      expect(result[0].content).toBe(baseSettings.systemPrompt);
      expect(result[0].content).not.toContain('IMPORTANT CONTEXT INFORMATION');
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
      expect(emptyResult[0].content).toBe(baseSettings.systemPrompt);
      expect(whitespaceResult[0].content).toBe(baseSettings.systemPrompt);
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
      // Last item is the empty assistant placeholder (as per llmStore contract)
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
      // system + user + assistant; trailing empty assistant placeholder is not
      // sent to the model.
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
      // system + 20 messages; trailing empty assistant placeholder is not sent.
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
      // /think is appended before context wrapping
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
          content: 'u'.repeat(getPromptCharBudget(baseModel)),
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
        '<context>ctx</context>\nmessage 2'
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
