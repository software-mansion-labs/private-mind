import DeviceInfo from 'react-native-device-info';
import {
  EXTENDED_CONTEXT_WINDOW_TOKENS,
  getConversationTokenBudget,
  getConversationWindowTokens,
  getPromptTokenBudget,
} from '../constants/context-window';
import { prepareMessagesForLLM } from '../utils/promptUtils';
import { formatContextChunks } from '../utils/contextUtils';
import {
  forgetModelContextCapacities,
  rememberModelContextCapacity,
} from '../utils/modelContextCapacity';
import { ChatSettings, Message } from '../database/chatRepository';
import { Model } from '../database/modelRepository';

const GB = 1024 * 1024 * 1024;
const mockTotalMemory = DeviceInfo.getTotalMemorySync as jest.Mock;

const model: Model = {
  id: 11,
  modelName: 'LFM 3 - 1.7B',
  source: 'remote',
  isDownloaded: true,
  modelPath: '/models/lfm3.pte',
  tokenizerPath: '/models/tokenizer.json',
  tokenizerConfigPath: '/models/tokenizer_config.json',
  thinking: true,
};

const settings = (thinkingEnabled: boolean) =>
  ({
    systemPrompt: 'You are a helpful assistant.',
    thinkingEnabled,
  }) as ChatSettings;

const at = (deviceRamGB: number, modelCapacityTokens?: number) => ({
  thinking: false,
  deviceRamGB,
  modelCapacityTokens,
});

describe('getConversationWindowTokens', () => {
  it.each([
    ['an 8 GB phone with an 8192 model gets 4096', at(7.5, 8192), 4096],
    ['a 12 GB phone with a 16384 model gets 4096', at(11.3, 16384), 4096],
    ['an 8 GB phone with a 3000 model gets 3000', at(7.5, 3000), 3000],
    ['an 8 GB phone with a 2048 model gets 2048', at(7.5, 2048), 2048],
    ['a 6 GB phone with an 8192 model gets 2048', at(5.6, 8192), 2048],
    ['a 4 GB iPhone SE with an 8192 model gets 2048', at(3.7, 8192), 2048],
    ['a model whose capacity was never read gets 2048', at(7.5), 2048],
  ])('%s', (_name, input, expected) => {
    expect(getConversationWindowTokens(model, input)).toBe(expected);
  });

  it('keeps today’s window while Think is on, so runaway thinking does not grow', () => {
    expect(
      getConversationWindowTokens(model, { ...at(11.3, 8192), thinking: true })
    ).toBe(2048);
  });

  it('keeps today’s prompt budget whenever the window does not grow', () => {
    expect(getConversationTokenBudget(model, at(5.6, 8192))).toBe(
      getPromptTokenBudget(model)
    );
  });

  it('reserves a quarter of the larger window for the answer', () => {
    expect(getConversationTokenBudget(model, at(7.5, 8192))).toBe(
      EXTENDED_CONTEXT_WINDOW_TOKENS * 0.75
    );
  });
});

let nextId = 1;
const turn = (role: Message['role'], content: string): Message => ({
  id: nextId++,
  chatId: 1,
  role,
  content,
  timestamp: 1_700_000_000_000,
});

const longChat = (): Message[] => [
  ...Array.from({ length: 30 }, (_, index) => [
    turn(
      'user',
      `Question ${index}: ${'tell me more about the harbour. '.repeat(6)}`
    ),
    turn(
      'assistant',
      `Answer ${index}: ${'the harbour was built in 1890. '.repeat(6)}`
    ),
  ]).flat(),
  turn('user', 'What did I ask first?'),
  turn('assistant', ''),
];

const guideContext = formatContextChunks([
  {
    document: 'Export screenshots at 1290 x 2796 pixels. '.repeat(80),
    similarity: 0.8,
    metadata: { documentId: 7, name: 'guide.txt' },
  },
] as Parameters<typeof formatContextChunks>[0]);

const promptOf = (thinkingEnabled = false, context: string[] = []) =>
  prepareMessagesForLLM(longChat(), context, settings(thinkingEnabled), model, {
    sourceDocuments: context.length
      ? [{ documentId: 7, name: 'guide.txt' }]
      : undefined,
  });

describe('prepareMessagesForLLM with a larger conversation window', () => {
  afterEach(() => {
    forgetModelContextCapacities();
    mockTotalMemory.mockReturnValue(8 * GB);
  });

  it('keeps more of a long conversation on an 8 GB phone with a capable model', () => {
    const before = promptOf().length;
    rememberModelContextCapacity(model.id, 8192);
    expect(promptOf().length).toBeGreaterThan(before);
  });

  it('keeps the same conversation on a 6 GB phone', () => {
    const before = promptOf().length;
    rememberModelContextCapacity(model.id, 8192);
    mockTotalMemory.mockReturnValue(5.6 * GB);
    expect(promptOf().length).toBe(before);
  });

  it('keeps the same conversation while Think is on', () => {
    const before = promptOf(true).length;
    rememberModelContextCapacity(model.id, 8192);
    expect(promptOf(true).length).toBe(before);
  });

  it('gives a document the same room it had before, only the history grows', () => {
    const sourcesOf = (messages: ReturnType<typeof promptOf>) =>
      messages.at(-1)!.content;
    const before = promptOf(false, guideContext);
    rememberModelContextCapacity(model.id, 8192);
    const after = promptOf(false, guideContext);

    expect(sourcesOf(after)).toBe(sourcesOf(before));
    expect(after.length).toBeGreaterThan(before.length);
  });
});
