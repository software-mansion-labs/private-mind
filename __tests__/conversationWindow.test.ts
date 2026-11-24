import DeviceInfo from 'react-native-device-info';
import {
  EXTENDED_CONTEXT_WINDOW_TOKENS,
  GROUNDED_ANSWER_TOKEN_LIMIT,
  getAnswerTokenLimit,
  getConversationTokenBudget,
  getConversationWindowTokens,
  getPromptTokenBudget,
  getSourceTokenBudget,
  hasExtendedSourceRoom,
  isExtendedWindowAvailable,
  sourceRoomFor,
  type ConversationMemory,
} from '../constants/context-window';
import {
  ADAPTIVE_EXTRA_CHUNK_MAX_SIMILARITY_GAP,
  EXTENDED_ROOM_EXTRA_RAG_CHUNKS,
  getModelProfile,
  withExtendedSourceRoom,
} from '../constants/model-profiles';
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
    {
      name: 'an 8 GB phone with an 8192 model gets 4096',
      input: at(7.5, 8192),
      expected: 4096,
    },
    {
      name: 'a 12 GB phone with a 16384 model gets 4096',
      input: at(11.3, 16384),
      expected: 4096,
    },
    {
      name: 'an 8 GB phone with a 3000 model gets 3000',
      input: at(7.5, 3000),
      expected: 3000,
    },
    {
      name: 'an 8 GB phone with a 2048 model gets 2048',
      input: at(7.5, 2048),
      expected: 2048,
    },
    {
      name: 'a 6 GB phone with an 8192 model gets 4096',
      input: at(5.6, 8192),
      expected: 4096,
    },
    {
      name: 'a 4 GB iPhone SE with an 8192 model gets 2048',
      input: at(3.7, 8192),
      expected: 2048,
    },
    {
      name: 'a model whose capacity was never read gets 2048',
      input: at(7.5),
      expected: 2048,
    },
  ])('$name', ({ input, expected }) => {
    expect(getConversationWindowTokens(model, input)).toBe(expected);
  });

  it('keeps today’s window while Think is on, so runaway thinking does not grow', () => {
    expect(
      getConversationWindowTokens(model, { ...at(11.3, 8192), thinking: true })
    ).toBe(2048);
  });

  it('keeps today’s prompt budget whenever the window does not grow', () => {
    expect(getConversationTokenBudget(model, at(3.7, 8192))).toBe(
      getPromptTokenBudget(model)
    );
  });

  it('reserves a quarter of the larger window for the answer', () => {
    expect(getConversationTokenBudget(model, at(7.5, 8192))).toBe(
      EXTENDED_CONTEXT_WINDOW_TOKENS * 0.75
    );
  });
});

describe('getAnswerTokenLimit', () => {
  it('lets the answer fill what the prompt leaves of the window', () => {
    expect(getAnswerTokenLimit(model, at(7.5, 8192), 1500)).toBe(
      EXTENDED_CONTEXT_WINDOW_TOKENS - 1500
    );
  });

  it('never gives the answer less than the window reserves for it', () => {
    expect(getAnswerTokenLimit(model, at(7.5, 8192), 4000)).toBe(
      EXTENDED_CONTEXT_WINDOW_TOKENS * 0.25
    );
  });

  it('keeps today’s window as the bound on a phone that does not get the larger one', () => {
    const base = getConversationWindowTokens(model, at(3.7, 8192));
    expect(getAnswerTokenLimit(model, at(3.7, 8192), 500)).toBe(base - 500);
  });

  it('stops a sourced answer at the grounded limit, where only monologues ran longer', () => {
    expect(
      getAnswerTokenLimit(
        model,
        { ...at(7.5, 8192), carriesSources: true },
        1500
      )
    ).toBe(GROUNDED_ANSWER_TOKEN_LIMIT);
  });

  it('leaves the answer unbounded while Think is on, since thinking spends the same room', () => {
    expect(
      getAnswerTokenLimit(model, { ...at(7.5, 8192), thinking: true }, 500)
    ).toBeUndefined();
  });
});

describe('conversation memory levels', () => {
  const withMemory = (
    memory: ConversationMemory,
    deviceRamGB: number,
    extra: { thinking?: boolean; carriesSources?: boolean } = {}
  ) => ({
    thinking: false,
    deviceRamGB,
    modelCapacityTokens: 8192,
    memory,
    ...extra,
  });

  it.each([
    {
      name: 'Low on a 12 GB phone',
      input: withMemory('low', 11.3),
      expected: 2048,
    },
    {
      name: 'Auto on a 6 GB phone',
      input: withMemory('auto', 5.6),
      expected: 4096,
    },
    {
      name: 'Auto on a 4 GB iPhone SE',
      input: withMemory('auto', 3.7),
      expected: 2048,
    },
    {
      name: 'High on a 6 GB phone',
      input: withMemory('high', 5.6),
      expected: 4096,
    },
    {
      name: 'High on an 8 GB phone',
      input: withMemory('high', 7.5),
      expected: 4096,
    },
    {
      name: 'High on a 4 GB iPhone SE',
      input: withMemory('high', 3.7),
      expected: 2048,
    },
  ])('$name', ({ input, expected }) => {
    expect(getConversationWindowTokens(model, input)).toBe(expected);
  });

  it('caps High at what the model file supports', () => {
    expect(
      getConversationWindowTokens(model, {
        ...withMemory('high', 5.6),
        modelCapacityTokens: 3000,
      })
    ).toBe(3000);
  });

  it('keeps the standard window for High while Think is on', () => {
    expect(
      getConversationWindowTokens(
        model,
        withMemory('high', 11.3, { thinking: true })
      )
    ).toBe(2048);
  });

  it('never shrinks below the standard window when a document or the web is in the prompt', () => {
    expect(
      getConversationWindowTokens(
        model,
        withMemory('low', 11.3, { carriesSources: true })
      )
    ).toBe(2048);
  });

  it('gives sources half of the extra room and leaves the rest to the conversation', () => {
    const input = withMemory('high', 7.5);
    const base = getPromptTokenBudget(model);
    const conversation = getConversationTokenBudget(model, input);
    expect(getSourceTokenBudget(model, input)).toBe(
      base + Math.floor((conversation - base) / 2)
    );
    expect(hasExtendedSourceRoom(model, input)).toBe(true);
  });

  it('keeps today’s source budget on Low and on phones that stay at the standard window', () => {
    const base = getPromptTokenBudget(model);
    expect(getSourceTokenBudget(model, withMemory('low', 11.3))).toBe(base);
    expect(getSourceTokenBudget(model, withMemory('auto', 3.7))).toBe(base);
    expect(hasExtendedSourceRoom(model, withMemory('low', 11.3))).toBe(false);
  });

  it.each([
    [3.7, false],
    [5.6, true],
    [7.5, true],
  ])('offers High on a phone reporting %s GB: %s', (ram, expected) => {
    expect(isExtendedWindowAvailable(ram)).toBe(expected);
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

const promptOf = (
  thinkingEnabled = false,
  context: string[] = [],
  conversationMemory: ConversationMemory = 'auto'
) =>
  prepareMessagesForLLM(longChat(), context, settings(thinkingEnabled), model, {
    sourceDocuments: context.length
      ? [{ documentId: 7, name: 'guide.txt' }]
      : undefined,
    conversationMemory,
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

  it('keeps the same conversation on a 4 GB phone', () => {
    const before = promptOf().length;
    rememberModelContextCapacity(model.id, 8192);
    mockTotalMemory.mockReturnValue(3.7 * GB);
    expect(promptOf().length).toBe(before);
  });

  it('keeps the same conversation while Think is on', () => {
    const before = promptOf(true).length;
    rememberModelContextCapacity(model.id, 8192);
    expect(promptOf(true).length).toBe(before);
  });

  it('gives a long document more room and still keeps more of the conversation', () => {
    const sourcesOf = (messages: ReturnType<typeof promptOf>) =>
      messages.at(-1)!.content;
    const before = promptOf(false, guideContext);
    rememberModelContextCapacity(model.id, 8192);
    const after = promptOf(false, guideContext);

    expect(sourcesOf(after).length).toBeGreaterThan(sourcesOf(before).length);
    expect(after.length).toBeGreaterThan(before.length);
  });

  it('keeps as much of a long conversation on Auto as on High on a 6 GB phone', () => {
    rememberModelContextCapacity(model.id, 8192);
    mockTotalMemory.mockReturnValue(5.6 * GB);
    const auto = promptOf();
    expect(promptOf(false, [], 'high')).toEqual(auto);
  });

  it('keeps fewer turns on Low and gives a document the standard room', () => {
    rememberModelContextCapacity(model.id, 8192);
    mockTotalMemory.mockReturnValue(3.7 * GB);
    const standardWithDocument = promptOf(false, guideContext);
    mockTotalMemory.mockReturnValue(5.6 * GB);
    const auto = promptOf();

    expect(promptOf(false, [], 'low').length).toBeLessThan(auto.length);
    expect(promptOf(false, guideContext, 'low').at(-1)!.content).toBe(
      standardWithDocument.at(-1)!.content
    );
  });
});

describe('withExtendedSourceRoom', () => {
  const profile = getModelProfile(model);

  it('offers extra document chunks on Auto only when they are nearly as similar as the best one', () => {
    expect(withExtendedSourceRoom(profile, 'adaptive')).toEqual({
      ...profile,
      ragExtraChunks: EXTENDED_ROOM_EXTRA_RAG_CHUNKS,
      ragExtraChunkMaxSimilarityGap: ADAPTIVE_EXTRA_CHUNK_MAX_SIMILARITY_GAP,
    });
  });

  it('takes every extra document chunk on High', () => {
    expect(withExtendedSourceRoom(profile, 'full')).toEqual({
      ...profile,
      ragExtraChunks: EXTENDED_ROOM_EXTRA_RAG_CHUNKS,
      ragExtraChunkMaxSimilarityGap: Number.POSITIVE_INFINITY,
    });
  });

  it('leaves the profile untouched at the standard window', () => {
    expect(withExtendedSourceRoom(profile, 'standard')).toBe(profile);
  });
});

describe('sourceRoomFor', () => {
  const withMemory = (memory: ConversationMemory, deviceRamGB: number) => ({
    thinking: false,
    deviceRamGB,
    modelCapacityTokens: 8192,
    memory,
    carriesSources: true,
  });

  it.each([
    { name: 'Low', input: withMemory('low', 11.3), expected: 'standard' },
    {
      name: 'Auto on a 6 GB phone',
      input: withMemory('auto', 5.6),
      expected: 'adaptive',
    },
    {
      name: 'High on a 6 GB phone',
      input: withMemory('high', 5.6),
      expected: 'full',
    },
    {
      name: 'Auto on a 4 GB iPhone SE',
      input: withMemory('auto', 3.7),
      expected: 'standard',
    },
  ])('$name', ({ input, expected }) => {
    expect(sourceRoomFor(model, input)).toBe(expected);
  });
});
