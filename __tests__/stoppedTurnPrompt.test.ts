import { prepareMessagesForLLM } from '../utils/promptUtils';
import type { ChatSettings, Message } from '../database/chatRepository';
import type { Model } from '../database/modelRepository';

const model = {
  id: 1,
  modelName: 'Test LLM',
  source: 'remote',
  isDownloaded: true,
  modelPath: 'm',
  tokenizerPath: 't',
  tokenizerConfigPath: 'tc',
  thinking: false,
} as Model;

const settings = {
  systemPrompt: 'You are a helpful assistant.',
  contextWindow: 4096,
  thinkingEnabled: false,
} as ChatSettings;

const message = (fields: Partial<Message>): Message =>
  ({
    id: 1,
    chatId: 1,
    timestamp: 0,
    role: 'user',
    content: '',
    ...fields,
  }) as Message;

const turns = (history: Message[]) =>
  prepareMessagesForLLM(history, [], settings, model)
    .filter((entry) => entry.role !== 'system')
    .map((entry) => `${entry.role}: ${entry.content}`);

describe('a question the user stopped before any answer', () => {
  it('is left out of the prompt so the model answers the new question', () => {
    const prompt = turns([
      message({
        id: 1,
        content: 'Explain the Byzantine Empire',
        stoppedByUser: true,
      }),
      message({ id: 2, content: 'What is the capital of France?' }),
    ]);

    expect(prompt).toHaveLength(1);
    expect(prompt[0]).toContain('What is the capital of France?');
    expect(prompt.join('\n')).not.toContain('Byzantine');
  });

  it('never leaves two questions in a row for the model to choose between', () => {
    const prompt = turns([
      message({ id: 1, content: 'First question', stoppedByUser: true }),
      message({ id: 2, content: 'Second question' }),
    ]);

    const roles = prompt.map((entry) => entry.split(':')[0]);
    expect(roles).not.toEqual(['user', 'user']);
  });

  it('keeps an answered turn, and the truncated answer the user can still see', () => {
    const prompt = turns([
      message({ id: 1, content: 'Explain the Byzantine Empire' }),
      message({
        id: 2,
        role: 'assistant',
        content: 'It began in 330 AD',
        stoppedByUser: true,
      }),
      message({ id: 3, content: 'What is the capital of France?' }),
    ]);

    expect(prompt).toHaveLength(3);
    expect(prompt[0]).toContain('Explain the Byzantine Empire');
    expect(prompt[1]).toContain('It began in 330 AD');
    expect(prompt[2]).toContain('What is the capital of France?');
  });
});
