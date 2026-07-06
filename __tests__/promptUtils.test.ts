import { prepareMessagesForLLM } from '../utils/promptUtils';
import { Message, ChatSettings } from '../database/chatRepository';
import { Model } from '../database/modelRepository';

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
        [{ documentId: 2, name: 'current.pdf' }]
      );

      expect(result[0].content).toContain('CURRENT ATTACHMENT PRIORITY');
      expect(result[0].content).toContain('current.pdf');
      expect(result[0].content).toContain(
        'You may still use earlier conversation'
      );
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
        [{ documentId: 2, name: 'current.pdf' }]
      );
      const last = result[result.length - 1];
      expect(last.content).toMatch(/Ignore any document mentioned earlier/i);
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
      expect(last.content).not.toMatch(/Ignore any document mentioned earlier/i);
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
      content: 'x'.repeat(2000),
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
      const hugeContext = 'y'.repeat(20000);

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
  });
});
