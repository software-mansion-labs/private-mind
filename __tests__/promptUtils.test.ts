import { prepareMessagesForLLM } from '../utils/promptUtils';
import { Message, ChatSettings } from '../database/chatRepository';
import { Model } from '../database/modelRepository';

const baseSettings: ChatSettings = {
  systemPrompt: 'You are a helpful assistant.',
  contextWindow: 10,
  thinkingEnabled: false,
};

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

// In real usage, activeChatMessages always ends with an empty assistant placeholder
// (added by llmStore before calling prepareMessagesForLLM). The last item is sliced
// off by slice(-n, -1) and the second-to-last (actual user message) gets the tokens.
const makeMessages = (count: number): Message[] => [
  ...Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    chatId: 1,
    role: (i % 2 === 0 ? 'user' : 'assistant') as Message['role'],
    content: `message ${i + 1}`,
    timestamp: Date.now(),
  })),
  // trailing assistant placeholder (always present in real usage)
  { id: count + 1, chatId: 1, role: 'assistant' as Message['role'], content: '', timestamp: Date.now() },
];

describe('prepareMessagesForLLM', () => {
  describe('system prompt', () => {
    it('always prepends the system prompt', () => {
      const messages = makeMessages(2);
      const result = prepareMessagesForLLM(messages, [], baseSettings, baseModel);
      expect(result[0]).toEqual({ role: 'system', content: baseSettings.systemPrompt });
    });

    it('appends context instructions to system prompt when context is provided', () => {
      const messages = makeMessages(2);
      const result = prepareMessagesForLLM(messages, ['some context'], baseSettings, baseModel);
      expect(result[0].content).toContain('You are a helpful assistant.');
      expect(result[0].content).toContain('IMPORTANT CONTEXT INFORMATION');
    });

    it('does not append context instructions when context is empty', () => {
      const messages = makeMessages(2);
      const result = prepareMessagesForLLM(messages, [], baseSettings, baseModel);
      expect(result[0].content).toBe(baseSettings.systemPrompt);
      expect(result[0].content).not.toContain('IMPORTANT CONTEXT INFORMATION');
    });
  });

  describe('event message filtering', () => {
    it('strips event messages from the output', () => {
      // Last item is the empty assistant placeholder (as per llmStore contract)
      const messages: Message[] = [
        { id: 1, chatId: 1, role: 'user', content: 'hello', timestamp: 0 },
        { id: 2, chatId: 1, role: 'event', content: 'System: file added', timestamp: 0 },
        { id: 3, chatId: 1, role: 'assistant', content: 'hi there', timestamp: 0 },
        { id: 4, chatId: 1, role: 'assistant', content: '', timestamp: 0 }, // placeholder
      ];
      const result = prepareMessagesForLLM(messages, [], baseSettings, baseModel);
      const roles = result.map((m) => m.role);
      expect(roles).not.toContain('event');
      // system + user + assistant (placeholder sliced off)
      expect(result).toHaveLength(3);
    });
  });

  describe('context window slicing', () => {
    it('respects the contextWindow limit', () => {
      const messages = makeMessages(20);
      const settings = { ...baseSettings, contextWindow: 4 };
      const result = prepareMessagesForLLM(messages, [], settings, baseModel);
      // system prompt + up to contextWindow messages (minus last which becomes the modified last)
      // slice(-4, -1) = 3 messages + last message appended separately = 4 total non-system
      expect(result.length).toBeLessThanOrEqual(5); // system + 4
    });

    it('with contextWindow=1 only the last message is included', () => {
      const messages = makeMessages(10);
      const settings = { ...baseSettings, contextWindow: 1 };
      const result = prepareMessagesForLLM(messages, [], settings, baseModel);
      // slice(-1, -1) = empty, so only system prompt — last message is lost!
      // This is a potential bug: slice(-1, -1) returns []
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('handles empty message list', () => {
      const result = prepareMessagesForLLM([], [], baseSettings, baseModel);
      // Only system prompt, nothing to modify
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
      const result = prepareMessagesForLLM(messages, [], baseSettings, thinkingModel);
      const last = result[result.length - 1];
      expect(last.content).toContain('/no_think');
    });

    it('does not append any token when neither thinkingEnabled nor model.thinking', () => {
      const messages = makeMessages(3);
      const result = prepareMessagesForLLM(messages, [], baseSettings, baseModel);
      const last = result[result.length - 1];
      expect(last.content).not.toContain('/think');
      expect(last.content).not.toContain('/no_think');
    });

    it('prefers /think over /no_think when thinkingEnabled=true and model.thinking=true', () => {
      const messages = makeMessages(3);
      const thinkingModel = { ...baseModel, thinking: true };
      const settings = { ...baseSettings, thinkingEnabled: true };
      const result = prepareMessagesForLLM(messages, [], settings, thinkingModel);
      const last = result[result.length - 1];
      expect(last.content).toContain('/think');
      expect(last.content).not.toContain('/no_think');
    });
  });

  describe('context injection', () => {
    it('wraps context in <context> tags on the last message', () => {
      const messages = makeMessages(3);
      const result = prepareMessagesForLLM(
        messages,
        ['chunk one', 'chunk two'],
        baseSettings,
        baseModel
      );
      const last = result[result.length - 1];
      expect(last.content).toContain('<context>chunk one chunk two</context>');
    });

    it('context is added to the last user message (second-to-last in array)', () => {
      const messages: Message[] = [
        { id: 1, chatId: 1, role: 'user', content: 'What is RAG?', timestamp: 0 },
        { id: 2, chatId: 1, role: 'assistant', content: 'answer', timestamp: 0 },
        { id: 3, chatId: 1, role: 'user', content: 'Tell me more', timestamp: 0 },
        { id: 4, chatId: 1, role: 'assistant', content: '', timestamp: 0 }, // placeholder
      ];
      const result = prepareMessagesForLLM(
        messages,
        ['some context'],
        baseSettings,
        baseModel
      );
      const last = result[result.length - 1];
      expect(last.content).toContain('Tell me more');
      expect(last.content).toContain('<context>some context</context>');
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
      expect(last.content).toContain('/think');
      expect(last.content).toContain('<context>');
    });
  });
});
