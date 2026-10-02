import type { Message } from '../database/chatRepository';
import type { Model } from '../database/modelRepository';
import { recordAnswerTrace } from '../utils/answerTrace';
import {
  runDevBenchmark,
  stopDevBenchmark,
} from '../utils/devBenchmark/runner';
import { useDevBenchmarkStore } from '../store/devBenchmarkStore';
import { writtenFiles } from '../__mocks__/react-native-fs';

const GB = 1024 ** 3;

const mockMessages = new Map<number, Message[]>();
const mockDigests = new Map<number, string>();
let mockMessageId = 0;
let mockChatId = 100;

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(),
}));

jest.mock('react-native-device-info', () => ({
  __esModule: true,
  default: {
    getUniqueIdSync: () => 'device-a',
    getModel: () => 'Pixel 9',
    getSystemVersion: () => '16',
    getVersion: () => '1.3.1',
    getBuildNumber: () => '42',
    getTotalMemorySync: () => 8 * 1024 ** 3,
    getFreeDiskStorage: jest.fn(async () => 3 * 1024 ** 3),
  },
}));

jest.mock('../utils/network', () => ({
  isDeviceOnline: jest.fn(async () => true),
}));

jest.mock('../database/chatRepository', () => ({
  createChat: jest.fn(async () => {
    mockChatId += 1;
    mockMessages.set(mockChatId, []);
    return mockChatId;
  }),
  deleteMessagesAfter: jest.fn(
    async (_db: unknown, chatId: number, messageId: number) => {
      mockMessages.set(
        chatId,
        (mockMessages.get(chatId) ?? []).filter(
          (message) => message.id <= messageId
        )
      );
    }
  ),
  getChatDigest: jest.fn(
    async (_db: unknown, chatId: number) => mockDigests.get(chatId) ?? null
  ),
  getChatMessages: jest.fn(async (_db: unknown, chatId: number) => [
    ...(mockMessages.get(chatId) ?? []),
  ]),
  getChatSettings: jest.fn(async () => ({ systemPrompt: 'Be helpful.' })),
}));

const mockDeleteChat = jest.fn(async (chatId: number) => {
  mockMessages.delete(chatId);
});

jest.mock('../store/chatStore', () => ({
  useChatStore: { getState: () => ({ deleteChat: mockDeleteChat }) },
}));

const GOOD_ANSWERS: Record<string, string> = {
  'cześć': 'Cześć! W czym mogę Ci dzisiaj pomóc?',
  'Why do leaves change colour in autumn?':
    'Leaves change colour because the tree stops making chlorophyll, so the yellow and orange pigments show through.',
  'a dlaczego?':
    'Bo drzewo przestaje wytwarzać chlorofil, więc zielony kolor znika z liści.',
  'زمین سورج کے گرد کیوں گھومتی ہے؟':
    'زمین سورج کی کشش ثقل کی وجہ سے اس کے گرد گھومتی ہے۔',
};

const hindiList = [
  'हर दिन एक ही समय पर सोएं।',
  'सोने से पहले फ़ोन दूर रखें।',
  'कमरे को ठंडा और अंधेरा रखें।',
  'शाम को कैफ़ीन न लें।',
  'दिन में थोड़ी देर टहलें।',
  'रात का खाना हल्का रखें।',
  'सोने से पहले किताब पढ़ें।',
]
  .map((tip, index) => `${index + 1}. **सुझाव ${index + 1}** ${tip}`)
  .join('\n');

const table =
  '| Body | Diameter | Distance from Earth |\n|---|---|---|\n| Sun | 1.39 million km | 150 million km |';

const goodAnswer = (prompt: string): string => {
  if (prompt.startsWith('अच्छी')) return hindiList;
  if (prompt.startsWith('Make a markdown table')) return table;
  return GOOD_ANSWERS[prompt]!;
};

let mockAnswerFor: (prompt: string, attempt: number) => string = goodAnswer;
const mockAttempts = new Map<string, number>();

const mockLlm = {
  model: null as Model | null,
  isLoading: false,
  generationError: null as null | { chatId: number; message: string },
  activeChatId: null as number | null,
  loadModel: jest.fn(async (model: Model) => {
    mockLlm.model = model.modelName === 'Broken' ? null : model;
  }),
  runBenchmark: jest.fn(async () => ({
    totalTime: 1000,
    timeToFirstToken: 300,
    tokensPerSecond: 20,
    tokensGenerated: 20,
    peakMemory: GB,
  })),
  setActiveChatId: jest.fn(async (chatId: number | null) => {
    mockLlm.activeChatId = chatId;
  }),
  interrupt: jest.fn(),
  sendChatMessage: jest.fn(async (prompt: string, chatId: number) => {
    mockLlm.generationError = null;
    const key = `${mockLlm.model?.modelName}:${prompt}`;
    const attempt = (mockAttempts.get(key) ?? 0) + 1;
    mockAttempts.set(key, attempt);
    const answer = mockAnswerFor(prompt, attempt);
    const messages = mockMessages.get(chatId)!;
    const history = messages.length;
    messages.push(
      {
        id: ++mockMessageId,
        chatId,
        role: 'user',
        content: prompt,
        timestamp: 0,
      },
      {
        id: ++mockMessageId,
        chatId,
        role: 'assistant',
        content: answer,
        timestamp: 0,
        timeToFirstToken: 250,
        tokensPerSecond: 22,
      }
    );
    await recordAnswerTrace(
      {
        question: prompt,
        raw: answer,
        tidied: answer,
        retries: [],
        final: answer,
        systemPromptChars: 900,
        chatId,
        promptMessages: history + 2,
      },
      { toFile: false }
    );
    mockDigests.set(chatId, `digest after ${mockMessageId}`);
    return true;
  }),
};

jest.mock('../store/llmStore', () => ({
  useLLMStore: { getState: () => mockLlm },
}));

const baseModel = (overrides: Partial<Model>): Model => ({
  id: 1,
  modelName: 'Model',
  source: 'built-in',
  isDownloaded: true,
  modelPath: 'https://example.com/model.pte',
  tokenizerPath: 'https://example.com/tokenizer.json',
  tokenizerConfigPath: 'https://example.com/tokenizer_config.json',
  ...overrides,
});

const mockModelState = {
  models: [] as Model[],
  downloadModel: jest.fn(async (model: Model) => {
    mockModelState.models = mockModelState.models.map((candidate) =>
      candidate.id === model.id
        ? { ...candidate, isDownloaded: true }
        : candidate
    );
  }),
};

jest.mock('../store/modelStore', () => ({
  useModelStore: { getState: () => mockModelState },
}));

const db = {} as Parameters<typeof runDevBenchmark>[0]['db'];

const userModel = baseModel({ id: 99, modelName: 'User model', modelSize: 1 });

beforeEach(() => {
  jest.clearAllMocks();
  mockMessages.clear();
  mockDigests.clear();
  mockAttempts.clear();
  writtenFiles.clear();
  mockAnswerFor = goodAnswer;
  mockLlm.model = userModel;
  mockLlm.activeChatId = 7;
  useDevBenchmarkStore.setState({ status: 'idle', run: null, queue: [] });
});

describe('runDevBenchmark', () => {
  it('runs the base chat on every model, saves the run and cleans up', async () => {
    mockModelState.models = [
      baseModel({ id: 2, modelName: 'Bigger', modelSize: 1.5 }),
      baseModel({ id: 1, modelName: 'Small', modelSize: 0.5 }),
    ];

    await runDevBenchmark({ db, mode: 'full' });

    const { run, status } = useDevBenchmarkStore.getState();
    expect(status).toBe('finished');
    expect(run?.models.map((model) => model.modelName)).toEqual([
      'Small',
      'Bigger',
    ]);
    for (const model of run!.models) {
      expect(model.verdict).toBe('pass');
      expect(model.speed).toEqual({
        tokPerS: 20,
        ttftMs: 300,
        peakMemoryBytes: GB,
      });
      expect(model.scenarios[0]!.turns).toHaveLength(6);
    }
    const firstTurn = run!.models[0]!.scenarios[0]!.turns[0]!;
    expect(firstTurn.attempts[0]).toMatchObject({
      final: 'Cześć! W czym mogę Ci dzisiaj pomóc?',
      systemChars: 900,
      promptMessages: 2,
      timings: { ttftMs: 250, tokPerS: 22 },
    });
    expect(run!.finishedAt).toBeDefined();
    expect(mockDeleteChat).toHaveBeenCalledTimes(2);
    expect(mockMessages.size).toBe(0);
    expect([...writtenFiles.keys()][0]).toContain('/dev-benchmark/');
    expect(mockLlm.model).toBe(userModel);
    expect(mockLlm.setActiveChatId).toHaveBeenLastCalledWith(7);
    const keepAwake = jest.requireMock('expo-keep-awake');
    expect(keepAwake.activateKeepAwakeAsync).toHaveBeenCalledWith(
      'dev-benchmark'
    );
    expect(keepAwake.deactivateKeepAwake).toHaveBeenCalledWith('dev-benchmark');
  });

  it('retries a failed turn once on a clean history and turns it yellow when it passes', async () => {
    mockModelState.models = [baseModel({ id: 1, modelName: 'Small' })];
    mockAnswerFor = (prompt, attempt) =>
      prompt === 'a dlaczego?' && attempt === 1
        ? 'Because the tree stops making chlorophyll and the green fades'
        : goodAnswer(prompt);

    await runDevBenchmark({ db, mode: 'full' });

    const turn =
      useDevBenchmarkStore.getState().run!.models[0]!.scenarios[0]!.turns[2]!;
    expect(turn.verdict).toBe('warn');
    expect(turn.attempts).toHaveLength(2);
    expect(turn.attempts[0]!.findings.map((item) => item.check)).toContain(
      'cut-off'
    );
    expect(turn.attempts[1]!.promptMessages).toBe(6);
    const chatRepository = jest.requireMock('../database/chatRepository');
    expect(chatRepository.deleteMessagesAfter).toHaveBeenCalledTimes(1);
  });

  it('keeps a turn red when its retry fails as well', async () => {
    mockModelState.models = [baseModel({ id: 1, modelName: 'Small' })];
    mockAnswerFor = (prompt) =>
      prompt.startsWith('अच्छी')
        ? '1. **नींद** समय पर सोएं।'
        : goodAnswer(prompt);

    await runDevBenchmark({ db, mode: 'full' });

    const model = useDevBenchmarkStore.getState().run!.models[0]!;
    expect(model.scenarios[0]!.turns[3]!.verdict).toBe('fail');
    expect(model.scenarios[0]!.verdict).toBe('fail');
    expect(model.verdict).toBe('fail');
  });

  it('marks a model that does not load red and moves on', async () => {
    mockModelState.models = [
      baseModel({ id: 1, modelName: 'Broken', modelSize: 0.5 }),
      baseModel({ id: 2, modelName: 'Small', modelSize: 1 }),
    ];

    await runDevBenchmark({ db, mode: 'full' });

    const [broken, small] = useDevBenchmarkStore.getState().run!.models;
    expect(broken).toMatchObject({
      verdict: 'fail',
      loadError: 'the model did not load',
      scenarios: [],
    });
    expect(broken!.loadMs).toBeUndefined();
    expect(small!.verdict).toBe('pass');
  });

  it('downloads a missing model that fits and skips one that does not', async () => {
    mockModelState.models = [
      baseModel({ id: 1, modelName: 'Ready', modelSize: 0.5 }),
      baseModel({
        id: 2,
        modelName: 'Missing',
        modelSize: 1,
        isDownloaded: false,
      }),
      baseModel({
        id: 3,
        modelName: 'Too big',
        modelSize: 2,
        isDownloaded: false,
      }),
    ];

    await runDevBenchmark({ db, mode: 'full' });

    const { run, queue } = useDevBenchmarkStore.getState();
    const byName = Object.fromEntries(
      run!.models.map((model) => [model.modelName, model])
    );
    expect(mockModelState.downloadModel).toHaveBeenCalledTimes(1);
    expect(byName.Missing!.verdict).toBe('pass');
    expect(byName['Too big']).toMatchObject({
      verdict: 'warn',
      skippedReason: 'needs 3.2 GB free, 3.0 GB left',
    });
    expect(queue.map((entry) => entry.state)).toEqual([
      'tested',
      'tested',
      'skipped',
    ]);
  });

  it('skips missing models when the device is offline', async () => {
    jest
      .requireMock('../utils/network')
      .isDeviceOnline.mockResolvedValueOnce(false);
    mockModelState.models = [
      baseModel({
        id: 2,
        modelName: 'Missing',
        modelSize: 1,
        isDownloaded: false,
      }),
    ];

    await runDevBenchmark({ db, mode: 'full' });

    expect(useDevBenchmarkStore.getState().run!.models[0]).toMatchObject({
      skippedReason: 'not downloaded and the device is offline',
    });
  });

  it('tests only the chosen model in quick mode, without downloads', async () => {
    const chosen = baseModel({ id: 5, modelName: 'Chosen' });
    mockModelState.models = [
      chosen,
      baseModel({ id: 6, modelName: 'Other', isDownloaded: false }),
    ];

    await runDevBenchmark({ db, mode: 'quick', quickModel: chosen });

    expect(
      useDevBenchmarkStore.getState().run!.models.map((m) => m.modelName)
    ).toEqual(['Chosen']);
    expect(mockModelState.downloadModel).not.toHaveBeenCalled();
  });

  it('stops after the turn in flight and leaves the run unfinished', async () => {
    mockModelState.models = [
      baseModel({ id: 1, modelName: 'Small', modelSize: 0.5 }),
      baseModel({ id: 2, modelName: 'Bigger', modelSize: 1 }),
    ];
    mockAnswerFor = (prompt) => {
      if (prompt === 'a dlaczego?') stopDevBenchmark();
      return goodAnswer(prompt);
    };

    await runDevBenchmark({ db, mode: 'full' });

    const { run, status } = useDevBenchmarkStore.getState();
    expect(status).toBe('finished');
    expect(run!.finishedAt).toBeUndefined();
    expect(run!.models).toHaveLength(1);
    expect(run!.models[0]!.scenarios[0]!.turns).toHaveLength(3);
    expect(mockLlm.interrupt).toHaveBeenCalled();
    expect(mockDeleteChat).toHaveBeenCalledTimes(1);
  });

  it('records a generation error and gives the turn its retry', async () => {
    mockModelState.models = [baseModel({ id: 1, modelName: 'Small' })];
    mockLlm.sendChatMessage.mockImplementationOnce(async (_prompt, chatId) => {
      mockLlm.generationError = {
        chatId,
        message: 'Failed to generate a response.',
      };
      return true;
    });

    await runDevBenchmark({ db, mode: 'full' });

    const greeting =
      useDevBenchmarkStore.getState().run!.models[0]!.scenarios[0]!.turns[0]!;
    expect(greeting.attempts[0]!.generationError).toBe(
      'Failed to generate a response.'
    );
    expect(greeting.attempts[1]!.generationError).toBeNull();
    expect(greeting.verdict).toBe('warn');
  });

  it('ignores a second start while a run is going', async () => {
    useDevBenchmarkStore.setState({ status: 'running' });

    await runDevBenchmark({ db, mode: 'full' });

    expect(mockLlm.loadModel).not.toHaveBeenCalled();
  });
});
