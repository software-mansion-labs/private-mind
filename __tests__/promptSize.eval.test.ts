import { readFileSync } from 'fs';
import { join } from 'path';
import { prepareMessagesForLLM } from '../utils/promptUtils';
import type { ChatSettings } from '../database/chatRepository';
import type { Message } from '../database/chatRepository';
import type { Model } from '../database/modelRepository';
import { sourceBlock } from '../utils/contextUtils';

const settings = {
  systemPrompt: 'You are a helpful assistant.',
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

const CONTEXT = [
  sourceBlock(
    0,
    'Example source',
    'The population was 1 799 000 in 2026. Opening hours are 10:00 to 17:00. The price is 799 EUR.'
  ),
];

const askedQuestions = (): string[] => {
  const raw = readFileSync(
    join(__dirname, 'fixtures', 'deviceConversations.json'),
    'utf8'
  );
  const conversations = JSON.parse(raw) as {
    turns: { role: string; content?: string }[];
  }[];
  return [
    ...new Set(
      conversations
        .flatMap((c) => c.turns)
        .filter((t) => t.role === 'user' && t.content)
        .map((t) => t.content as string)
    ),
  ];
};

const promptFor = (question: string): string => {
  const messages: Message[] = [
    {
      id: 1,
      chatId: 1,
      role: 'user',
      content: question,
      timestamp: 0,
    } as Message,
  ];
  return prepareMessagesForLLM(messages, CONTEXT, settings, model)[0]!
    .content as string;
};

describe('the assembled system prompt on real questions', () => {
  it('reports how many characters a grounded answer is instructed with', () => {
    const questions = askedQuestions();
    const built = questions.map((q) => promptFor(q));
    const paras = built
      .map((p) => p.split('\n\n').filter((x) => x.trim()).length)
      .sort((a, b) => a - b);
    const sizes = built.map((p) => p.length).sort((a, b) => a - b);
    const bySize = [...built].sort((a, b) => b.length - a.length);
    process.stdout.write(
      `paragraphs median ${paras[Math.floor(paras.length / 2)]}  max ${paras[paras.length - 1]}\n`
    );
    bySize[0]!
      .split('\n\n')
      .filter((x) => x.trim())
      .forEach((block, i) =>
        process.stdout.write(
          `  block ${i} ${String(block.length).padStart(5)}  ${block.slice(0, 62).replace(/\n/g, ' ')}\n`
        )
      );
    const median = sizes[Math.floor(sizes.length / 2)]!;
    const mean = Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length);

    process.stdout.write(
      [
        '',
        '=== SYSTEM PROMPT SIZE (grounded, real questions) ===',
        `questions      ${questions.length}`,
        `min            ${sizes[0]}`,
        `median         ${median}`,
        `mean           ${mean}`,
        `max            ${sizes[sizes.length - 1]}`,
        `over 2500      ${sizes.filter((n) => n > 2500).length} (${Math.round((100 * sizes.filter((n) => n > 2500).length) / sizes.length)}%)`,
        `over 3000      ${sizes.filter((n) => n > 3000).length}`,
        '',
      ].join('\n') + '\n'
    );

    expect(median).toBeGreaterThan(0);
  });
});
