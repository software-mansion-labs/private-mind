import { prepareMessagesForLLM } from '../utils/promptUtils';
import { IMAGE_ONLY_QUESTION } from '../utils/imageQuestion';
import { ChatSettings, Message } from '../database/chatRepository';
import { Model } from '../database/modelRepository';
import type { LLMMessage } from '../types/llmMessage';

const settings = {
  systemPrompt:
    'You are a knowledgeable and helpful assistant. Provide clear, accurate, and well-structured responses.',
  thinkingEnabled: false,
} as ChatSettings;

const model: Model = {
  id: 1,
  modelName: 'TestModel',
  source: 'local',
  isDownloaded: true,
  modelPath: '/path/model.pte',
  tokenizerPath: '/path/tokenizer.json',
  tokenizerConfigPath: '/path/tokenizer_config.json',
  thinking: false,
};

const LANGUAGE_INSTRUCTION = /Answer in /;

const chat = (
  ...turns: (Pick<Message, 'role' | 'content'> & Partial<Message>)[]
): Message[] =>
  turns.map((turn, index) => ({
    id: index + 1,
    chatId: 1,
    timestamp: index,
    ...turn,
  }));

const user = (content: string, extra: Partial<Message> = {}) => ({
  role: 'user' as const,
  content,
  ...extra,
});
const assistant = (content: string) => ({
  role: 'assistant' as const,
  content,
});
const pendingReply = assistant('');

const conversationTurns = (prompt: LLMMessage[]): LLMMessage[] =>
  prompt.slice(1);

const userTurns = (prompt: LLMMessage[]): LLMMessage[] =>
  prompt.filter((message) => message.role === 'user');

const anchorCount = (prompt: LLMMessage[]): number =>
  conversationTurns(prompt).filter((message) =>
    LANGUAGE_INSTRUCTION.test(message.content)
  ).length;

describe('the answer-language instruction is never part of what the user wrote', () => {
  it('sends turn 2 of "Hi" then "What did I just say?" with the instruction once and the question untouched', () => {
    const prompt = prepareMessagesForLLM(
      chat(
        user('Hi'),
        assistant('Hello! How can I help you today?'),
        user('What did I just say?'),
        pendingReply
      ),
      [],
      settings,
      model
    );

    expect(anchorCount(prompt)).toBe(1);
    expect(userTurns(prompt).at(-1)!.content).toBe('What did I just say?');
    for (const turn of userTurns(prompt)) {
      expect(turn.content).not.toMatch(LANGUAGE_INSTRUCTION);
    }
  });

  it('keeps an earlier user message in the history exactly as the user typed it', () => {
    const prompt = prepareMessagesForLLM(
      chat(
        user('I like green tea with honey.'),
        assistant('Green tea with honey is a lovely combination.'),
        user('What did I just say?'),
        pendingReply
      ),
      [],
      settings,
      model
    );

    expect(userTurns(prompt).map((turn) => turn.content)).toEqual([
      'I like green tea with honey.',
      'What did I just say?',
    ]);
    expect(anchorCount(prompt)).toBe(1);
  });

  it('gives the instruction its own system turn right after the question', () => {
    const prompt = prepareMessagesForLLM(
      chat(user('What is the capital of France?'), pendingReply),
      [],
      settings,
      model
    );

    expect(prompt.at(-2)).toEqual({
      role: 'user',
      content: 'What is the capital of France?',
    });
    expect(prompt.at(-1)).toEqual({
      role: 'system',
      content: '(Answer in English.)',
    });
  });

  it('keeps the sources and the question in the user turn and the instruction after them', () => {
    const prompt = prepareMessagesForLLM(
      chat(user('Who is the prime minister of the UK now?'), pendingReply),
      ['Keir Starmer is the prime minister.'],
      settings,
      model
    );

    const question = userTurns(prompt).at(-1)!.content;
    expect(question).toContain('<sources>');
    expect(question.endsWith('Who is the prime minister of the UK now?')).toBe(
      true
    );
    expect(prompt.at(-1)).toEqual({
      role: 'system',
      content: '(Answer in English.)',
    });
  });

  it('leaves the thinking switch on the question, not on the instruction', () => {
    const prompt = prepareMessagesForLLM(
      chat(user('What is the capital of France?'), pendingReply),
      [],
      settings,
      { ...model, thinking: true }
    );

    expect(userTurns(prompt).at(-1)!.content).toBe(
      'What is the capital of France? /no_think'
    );
    expect(prompt.at(-1)!.content).toBe('(Answer in English.)');
  });

  it('still sends a picture with no text as a non-empty question', () => {
    const prompt = prepareMessagesForLLM(
      chat(user('', { imagePath: '/photo.jpg' }), pendingReply),
      [],
      settings,
      { ...model, vision: true }
    );

    const question = userTurns(prompt).at(-1)!;
    expect(question.content).toBe(IMAGE_ONLY_QUESTION);
    expect(question.mediaPath).toBe('/photo.jpg');
    expect(prompt.at(-1)!.role).toBe('system');
  });

  it.each([
    ['Polish', 'Jaka jest stolica Francji i ile ma mieszkańców?'],
    ['Hindi', 'फ्रांस की राजधानी क्या है और वहाँ कितने लोग रहते हैं?'],
    ['Urdu', 'فرانس کا دارالحکومت کیا ہے اور وہاں کتنے لوگ رہتے ہیں؟'],
    ['Arabic', 'ما هي عاصمة فرنسا وكم عدد سكانها؟'],
    ['Persian', 'پایتخت فرانسه کجاست و چند نفر در آن زندگی می‌کنند؟'],
  ])(
    'names %s in the instruction for a question written in it',
    (name, text) => {
      const prompt = prepareMessagesForLLM(
        chat(user(text), pendingReply),
        [],
        settings,
        model
      );

      expect(prompt.at(-1)).toEqual({
        role: 'system',
        content: `(Answer in ${name}.)`,
      });
      expect(userTurns(prompt).at(-1)!.content).toBe(text);
    }
  );

  it('asks for the language of the latest user message when it cannot be named', () => {
    const prompt = prepareMessagesForLLM(
      chat(user('Gdansk 2026'), pendingReply),
      [],
      settings,
      model
    );

    expect(prompt.at(-1)).toEqual({
      role: 'system',
      content: "(Answer in the same language as the user's latest message.)",
    });
  });
});
