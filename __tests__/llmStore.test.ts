import Toast from 'react-native-toast-message';
import {
  BACKGROUND_RELEASE_DELAY_MS,
  MODEL_WARMUP_TIMEOUT_MS,
  useLLMStore,
} from '../store/llmStore';
import { LLMModule } from 'react-native-executorch/legacy';
import * as chatRepository from '../database/chatRepository';
import type { Message } from '../database/chatRepository';
import type { Model } from '../database/modelRepository';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as Feedback from '../utils/Feedback';
import { prepareMessagesForLLM } from '../utils/promptUtils';
import { useSettingsStore } from '../store/settingsStore';
import { useWebSearchStore } from '../store/webSearchStore';
import { OPENING_WELCOMES } from '../constants/opening-greetings';

const memoryProbe = { samples: [] as number[], available: false };
jest.mock('../modules/memory-probe', () => ({
  PHYS_FOOTPRINT_METRIC: 'phys_footprint',
  TOTAL_PSS_METRIC: 'total_pss',
  isPhysFootprintAvailable: () => memoryProbe.available,
  isMemoryMetricAvailable: () => memoryProbe.available,
  memorySampleIntervalMs: () => 250,
  getPhysFootprintBytes: () => memoryProbe.samples.shift() ?? null,
  getMemoryFootprintBytes: () => memoryProbe.samples.shift() ?? null,
}));

jest.mock('../database/chatRepository');
jest.mock('../utils/Feedback', () => ({
  Feedback: { firstToken: jest.fn() },
}));
jest.mock('../utils/promptUtils', () => ({
  prepareMessagesForLLM: jest.fn(() => [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: '' },
  ]),
  answerLanguageAnchor: jest.fn(
    () => ' (Answer in the same language as this message.)'
  ),
  focusedRetrySystemPrompt: jest.fn(() => 'Answer from the quoted lines.'),
}));
jest.mock('../constants/default-benchmark', () => ({
  BENCHMARK_PROMPT: 'benchmark prompt text',
  BENCHMARK_TOKEN_TARGET: 128,
  BENCHMARK_WARMUP_RUNS: 1,
  BENCHMARK_ITERATIONS: 3,
  BENCHMARK_GENERATION_CONFIG: { temperature: 0.01, topP: 1, minP: 0 },
}));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn().mockResolvedValue({ isConnected: true }) },
}));

const mockLLMModule = LLMModule as jest.Mocked<typeof LLMModule>;
const mockPersistMessage = chatRepository.persistMessage as jest.Mock;
const mockMarkMessageStopped = chatRepository.markMessageStopped as jest.Mock;
const mockGetChatMessages = chatRepository.getChatMessages as jest.Mock;

const noSources = async () => ({
  context: [] as string[],
  sourceDocuments: [],
  preferredSourceDocuments: [],
});

const mockDb = {} as unknown as SQLiteDatabase;

const baseModel = {
  id: 1,
  modelName: 'Test LLM',
  source: 'remote' as const,
  isDownloaded: true,
  modelPath: 'https://example.com/model.pte',
  tokenizerPath: 'https://example.com/tokenizer.json',
  tokenizerConfigPath: 'https://example.com/tokenizer_config.json',
  thinking: false,
};

// Captures the token callback registered during loadModel so tests can fire tokens
let capturedTokenCallback: ((token: string) => void) | null | undefined = null;

const makeMockInstance = () => ({
  generate: jest.fn(),
  interrupt: jest.fn(),
  delete: jest.fn(),
  configure: jest.fn(),
  getGeneratedTokenCount: jest.fn(() => 10),
});

let mockInstance = makeMockInstance();

const WARMUP_REPLY = 'Hello';

beforeEach(() => {
  memoryProbe.available = false;
  memoryProbe.samples = [];
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  capturedTokenCallback = null;
  mockInstance = makeMockInstance();

  mockLLMModule.fromModelName.mockImplementation(
    async (_namedSources, _onProgress, onToken) => {
      capturedTokenCallback = onToken;
      return mockInstance as unknown as LLMModule;
    }
  );

  useLLMStore.setState({
    isLoading: false,
    isGenerating: false,
    isProcessingPrompt: false,
    isBenchmarking: false,
    db: mockDb,
    model: null,
    performance: { tokenCount: 0, firstTokenTime: 0 },
    activeChatId: null,
    generatingForChatId: null,
    activeChatMessages: [],
    generationError: null,
  });

  // Default: settings already hydrated, so the hydration barrier is a no-op
  // for every test except the cold-start one below (which opts into false).
  useSettingsStore.setState({ hasHydrated: true, customSystemPrompt: '' });

  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  // Re-apply the fromModelName mock after clearAllMocks
  mockLLMModule.fromModelName.mockImplementation(
    async (_namedSources, _onProgress, onToken) => {
      capturedTokenCallback = onToken;
      return mockInstance as unknown as LLMModule;
    }
  );
});

afterEach(async () => {
  await flushFrame();
  jest.restoreAllMocks();
});

// Helper to load a model and get the registered token callback
const loadModel = async (model = baseModel) => {
  await useLLMStore.getState().loadModel(model);
  mockInstance.generate.mockClear();
  return capturedTokenCallback!;
};

const flushFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

// ─── loadModel ───────────────────────────────────────────────────────────────

describe('loadModel', () => {
  it('sets isLoading during load then clears it', async () => {
    let wasLoading = false;
    mockLLMModule.fromModelName.mockImplementation(async (...args) => {
      wasLoading = useLLMStore.getState().isLoading;
      capturedTokenCallback = args[2];
      return mockInstance as unknown as LLMModule;
    });

    await useLLMStore.getState().loadModel(baseModel);

    expect(wasLoading).toBe(true);
    expect(useLLMStore.getState().isLoading).toBe(false);
  });

  it('skips reload for the same model id without hardReload', async () => {
    useLLMStore.setState({ model: baseModel });
    await useLLMStore.getState().loadModel(baseModel);
    expect(mockLLMModule.fromModelName).not.toHaveBeenCalled();
  });

  it('reloads same model when hardReload=true', async () => {
    useLLMStore.setState({ model: baseModel });
    await useLLMStore.getState().loadModel(baseModel, true);
    expect(mockLLMModule.fromModelName).toHaveBeenCalled();
  });

  it('calls delete on previous instance before loading new model', async () => {
    // Load first model
    await useLLMStore.getState().loadModel(baseModel);
    const firstInstance = mockInstance;

    // Load a different model
    mockInstance = makeMockInstance();
    mockLLMModule.fromModelName.mockImplementation(async (...args) => {
      capturedTokenCallback = args[2];
      return mockInstance as unknown as LLMModule;
    });
    await useLLMStore.getState().loadModel({ ...baseModel, id: 2 });

    expect(firstInstance.delete).toHaveBeenCalled();
  });

  it('clears model and isLoading on load failure', async () => {
    mockLLMModule.fromModelName.mockRejectedValue(new Error('load failed'));
    await useLLMStore.getState().loadModel(baseModel);
    expect(useLLMStore.getState().isLoading).toBe(false);
    expect(useLLMStore.getState().model).toBeNull();
  });

  it('tells the user the model could not be loaded instead of falling back in silence', async () => {
    mockLLMModule.fromModelName.mockRejectedValue(new Error('load failed'));
    await useLLMStore.getState().loadModel(baseModel);
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        text1: expect.stringContaining(`Couldn't load ${baseModel.modelName}`),
      })
    );
  });

  it('serializes duplicate load requests for the same model', async () => {
    let finishLoad!: () => void;
    const loadGate = new Promise<void>((resolve) => {
      finishLoad = resolve;
    });
    mockLLMModule.fromModelName.mockImplementationOnce(async (...args) => {
      capturedTokenCallback = args[2];
      await loadGate;
      return mockInstance as unknown as LLMModule;
    });

    const first = useLLMStore.getState().loadModel(baseModel);
    const second = useLLMStore.getState().loadModel(baseModel);
    // The load chain hops through several awaits before reaching
    // fromModelName; a single microtask flush is not enough.
    await flushFrame();

    expect(mockLLMModule.fromModelName).toHaveBeenCalledTimes(1);
    finishLoad();
    await Promise.all([first, second]);

    expect(mockLLMModule.fromModelName).toHaveBeenCalledTimes(1);
  });
});

describe('runWithModelOffloaded', () => {
  it('unloads the LLM for the operation and restores it afterwards', async () => {
    await loadModel();
    const operation = jest.fn().mockResolvedValue('done');

    await expect(
      useLLMStore.getState().runWithModelOffloaded(operation)
    ).resolves.toBe('done');

    expect(mockInstance.delete).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(mockLLMModule.fromModelName).toHaveBeenCalledTimes(2);
    expect(useLLMStore.getState().model).toEqual(baseModel);
    expect(useLLMStore.getState().isLoading).toBe(false);
  });

  it('restores the LLM when the offloaded operation fails', async () => {
    await loadModel();

    await expect(
      useLLMStore.getState().runWithModelOffloaded(async () => {
        throw new Error('embedding failed');
      })
    ).rejects.toThrow('embedding failed');

    expect(mockInstance.delete).toHaveBeenCalledTimes(1);
    expect(mockLLMModule.fromModelName).toHaveBeenCalledTimes(2);
    expect(useLLMStore.getState().model).toEqual(baseModel);
  });

  it('serializes offloaded operations', async () => {
    await loadModel();
    let finishFirst!: () => void;
    let markFirstStarted!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    const order: string[] = [];

    const first = useLLMStore.getState().runWithModelOffloaded(async () => {
      order.push('first-start');
      markFirstStarted();
      await firstGate;
      order.push('first-end');
    });
    const second = useLLMStore.getState().runWithModelOffloaded(async () => {
      order.push('second');
    });

    await firstStarted;
    expect(order).toEqual(['first-start']);

    finishFirst();
    await Promise.all([first, second]);

    expect(order).toEqual(['first-start', 'first-end', 'second']);
    expect(mockInstance.delete).toHaveBeenCalledTimes(2);
    expect(mockLLMModule.fromModelName).toHaveBeenCalledTimes(3);
  });

  it('can leave the LLM unloaded until generation needs it', async () => {
    await loadModel();

    await useLLMStore
      .getState()
      .runWithModelOffloaded(async () => {}, { restore: false });

    expect(mockInstance.delete).toHaveBeenCalledTimes(1);
    expect(mockLLMModule.fromModelName).toHaveBeenCalledTimes(1);

    await useLLMStore.getState().loadModel(baseModel);
    expect(mockLLMModule.fromModelName).toHaveBeenCalledTimes(2);
  });
});

// ─── token callback ───────────────────────────────────────────────────────────

describe('token callback', () => {
  it('increments tokenCount on each token', async () => {
    const onToken = await loadModel();
    useLLMStore.setState({ isProcessingPrompt: true, isGenerating: true });

    onToken('hello');
    onToken(' world');
    await flushFrame();

    expect(useLLMStore.getState().performance.tokenCount).toBe(2);
  });

  it('sets firstTokenTime only on first token', async () => {
    const onToken = await loadModel();
    useLLMStore.setState({ isProcessingPrompt: true, isGenerating: true });

    onToken('first');
    await flushFrame();
    const firstTime = useLLMStore.getState().performance.firstTokenTime;
    expect(firstTime).toBeGreaterThan(0);

    onToken('second');
    await flushFrame();
    expect(useLLMStore.getState().performance.firstTokenTime).toBe(firstTime);
  });

  it('triggers Feedback.firstToken on first token when not benchmarking', async () => {
    const onToken = await loadModel();
    useLLMStore.setState({
      isProcessingPrompt: true,
      isGenerating: true,
      isBenchmarking: false,
    });

    onToken('first');

    expect(Feedback.Feedback.firstToken).toHaveBeenCalledTimes(1);
  });

  it('does not trigger Feedback.firstToken during benchmarking', async () => {
    const onToken = await loadModel();
    useLLMStore.setState({
      isProcessingPrompt: true,
      isGenerating: true,
      isBenchmarking: true,
    });

    onToken('first');

    expect(Feedback.Feedback.firstToken).not.toHaveBeenCalled();
  });

  it("appends token to the turn's own message when generating for active chat", async () => {
    const onToken = await loadModel();
    useLLMStore.setState({
      isProcessingPrompt: false,
      isGenerating: true,
      activeChatId: 5,
      generatingForChatId: 5,
      generatingMessageLocalId: 7,
      performance: { tokenCount: 1, firstTokenTime: 1 },
      activeChatMessages: [
        { id: 1, chatId: 5, role: 'user', content: 'Hi', timestamp: 0 },
        {
          id: -1,
          localId: 7,
          chatId: 5,
          role: 'assistant',
          content: '',
          timestamp: 0,
        },
      ],
    });

    onToken(' hello');
    await flushFrame();

    const messages = useLLMStore.getState().activeChatMessages;
    expect(messages[messages.length - 1].content).toBe(' hello');
  });

  it('does not append token when generatingForChatId differs from activeChatId', async () => {
    const onToken = await loadModel();
    useLLMStore.setState({
      isProcessingPrompt: false,
      isGenerating: true,
      activeChatId: 99, // user navigated away
      generatingForChatId: 5,
      performance: { tokenCount: 1, firstTokenTime: 1 },
      activeChatMessages: [
        {
          id: -1,
          chatId: 99,
          role: 'assistant',
          content: 'other chat',
          timestamp: 0,
        },
      ],
    });

    onToken('should not appear');

    const messages = useLLMStore.getState().activeChatMessages;
    expect(messages[0].content).toBe('other chat');
  });

  it('calls interrupt on first token when generation was cancelled (prefill interrupt)', async () => {
    const onToken = await loadModel();
    // Simulate: user cancelled (isProcessingPrompt=false, isGenerating=false) but first token arrived
    useLLMStore.setState({
      isProcessingPrompt: false,
      isGenerating: false,
      performance: { tokenCount: 0, firstTokenTime: 0 },
    });

    onToken('late token');

    expect(mockInstance.interrupt).toHaveBeenCalled();
  });
});

// ─── interrupt ───────────────────────────────────────────────────────────────

describe('interrupt', () => {
  it('calls llmInstance.interrupt when isGenerating', async () => {
    await loadModel();
    useLLMStore.setState({ isGenerating: true });

    useLLMStore.getState().interrupt();

    expect(mockInstance.interrupt).toHaveBeenCalled();
  });

  it('resets isGenerating and isProcessingPrompt', async () => {
    await loadModel();
    useLLMStore.setState({ isGenerating: true, isProcessingPrompt: true });

    useLLMStore.getState().interrupt();

    expect(useLLMStore.getState().isGenerating).toBe(false);
    expect(useLLMStore.getState().isProcessingPrompt).toBe(false);
  });

  it('resets isProcessingPrompt even when not isGenerating', () => {
    useLLMStore.setState({ isGenerating: false, isProcessingPrompt: true });

    useLLMStore.getState().interrupt();

    expect(useLLMStore.getState().isProcessingPrompt).toBe(false);
  });

  it('marks the answer stopped in the same turn as the press, not after the save', async () => {
    await loadModel();
    useLLMStore.setState({
      isGenerating: true,
      generatingMessageLocalId: 42,
      activeChatMessages: [
        {
          id: -1,
          localId: 42,
          role: 'assistant',
          content: 'half an answ',
          chatId: 1,
          timestamp: 0,
        },
      ],
    });

    useLLMStore.getState().interrupt();

    expect(useLLMStore.getState().activeChatMessages[0].stoppedByUser).toBe(
      true
    );
  });

  it('leaves other messages alone when it marks the stopped one', async () => {
    await loadModel();
    useLLMStore.setState({
      isGenerating: true,
      generatingMessageLocalId: 42,
      activeChatMessages: [
        {
          id: 7,
          localId: 41,
          role: 'assistant',
          content: 'an earlier answer',
          chatId: 1,
          timestamp: 0,
        },
        {
          id: -1,
          localId: 42,
          role: 'assistant',
          content: 'half an answ',
          chatId: 1,
          timestamp: 0,
        },
      ],
    });

    useLLMStore.getState().interrupt();

    const [earlier, stopped] = useLLMStore.getState().activeChatMessages;
    expect(earlier.stoppedByUser).toBeUndefined();
    expect(stopped.stoppedByUser).toBe(true);
  });

  it('does nothing when neither generating nor processing', () => {
    useLLMStore.setState({ isGenerating: false, isProcessingPrompt: false });
    expect(() => useLLMStore.getState().interrupt()).not.toThrow();
  });

  it('drops the empty placeholder and the live trace at once when stopped before any token', () => {
    useWebSearchStore.getState().setSearchingWeb(true);
    useWebSearchStore.getState().pushWebSearchEvent({ type: 'objectives' });
    useLLMStore.setState({
      isGenerating: false,
      isProcessingPrompt: true,
      generatingMessageLocalId: 3,
      activeChatMessages: [
        { id: 5, role: 'user', content: 'ping', chatId: 1, timestamp: 0 },
        {
          id: -1,
          localId: 3,
          role: 'assistant',
          content: '',
          chatId: 1,
          timestamp: 0,
        },
      ] as Message[],
    });

    useLLMStore.getState().interrupt();

    expect(
      useLLMStore.getState().activeChatMessages.map((m) => m.role)
    ).toEqual(['user']);
    expect(useWebSearchStore.getState().webSearchTrace).toEqual([]);
    expect(useWebSearchStore.getState().isSearchingWeb).toBe(false);
    expect(useLLMStore.getState().isProcessingPrompt).toBe(false);
  });

  it('interrupts a pending utility call such as the search planner', async () => {
    await loadModel();
    let release: (value: string) => void = () => {};
    mockInstance.generate.mockImplementationOnce(
      () => new Promise<string>((resolve) => (release = resolve))
    );
    const planning = useLLMStore
      .getState()
      .generateUtility([{ role: 'user', content: 'plan' }]);
    useLLMStore.setState({ isGenerating: false, isProcessingPrompt: true });

    useLLMStore.getState().interrupt();

    expect(mockInstance.interrupt).toHaveBeenCalled();
    release('');
    await planning;
  });
});

// ─── sendChatMessage ──────────────────────────────────────────────────────────

describe('sendChatMessage', () => {
  const settings = { systemPrompt: 'be helpful' };

  beforeEach(async () => {
    await loadModel();
    mockPersistMessage.mockResolvedValue(42);
    mockInstance.generate.mockResolvedValue('The answer is 42.');
  });

  it('returns early when db is not set', async () => {
    useLLMStore.setState({ db: null });
    await useLLMStore.getState().sendChatMessage('hi', 1, noSources, settings);
    expect(mockPersistMessage).not.toHaveBeenCalled();
  });

  it('returns early when model is not loaded', async () => {
    useLLMStore.setState({ model: null });
    await useLLMStore.getState().sendChatMessage('hi', 1, noSources, settings);
    expect(mockPersistMessage).not.toHaveBeenCalled();
  });

  describe('a greeting that opens the chat', () => {
    const openChat = (activeChatMessages: Message[] = []) =>
      useLLMStore.setState({
        model: baseModel,
        activeChatId: 1,
        activeChatMessages,
      });

    const earlierTurn: Message[] = [
      { id: 1, chatId: 1, role: 'user', content: 'ping', timestamp: 0 },
      { id: 2, chatId: 1, role: 'assistant', content: 'pong', timestamp: 0 },
    ];

    afterEach(() => useSettingsStore.setState({ customSystemPrompt: '' }));

    const promptOptions = () =>
      (prepareMessagesForLLM as jest.Mock).mock.calls.at(-1)?.[4];

    const modelWelcome =
      'Hello! I am a private assistant running on your phone.\n\n' +
      '- Explain an idea\n- Draft a message\n- Summarize a file\n\n' +
      'Where shall we begin?';

    it('lets the model write the welcome, from the prepared one as its example', async () => {
      openChat();
      mockInstance.generate.mockResolvedValueOnce(modelWelcome);

      await useLLMStore
        .getState()
        .sendChatMessage('Hi!', 1, noSources, settings);

      expect(mockInstance.generate).toHaveBeenCalled();
      expect(promptOptions()).toEqual(
        expect.objectContaining({ openingWelcome: OPENING_WELCOMES.en })
      );
      expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
        modelWelcome
      );
    });

    it('does not spend a second generation on summarising a hello', async () => {
      openChat();
      mockInstance.generate.mockResolvedValueOnce(modelWelcome);

      await useLLMStore
        .getState()
        .sendChatMessage('Hi!', 1, noSources, settings);
      await flushFrame();

      expect(mockInstance.generate).toHaveBeenCalledTimes(1);
    });

    it('gathers no sources for a greeting', async () => {
      openChat();
      mockInstance.generate.mockResolvedValueOnce(modelWelcome);
      const buildSources = jest.fn(noSources);

      await useLLMStore
        .getState()
        .sendChatMessage('Hi!', 1, buildSources, settings);

      expect(buildSources).not.toHaveBeenCalled();
    });

    it.each([
      [
        'in another script',
        '안녕하세요! 무엇을 도와드릴까요? 저는 개인 비서입니다.',
      ],
      ['in another language', OPENING_WELCOMES.pl],
      ['with a bare greeting', 'Hi!'],
      ['with an essay', 'A greeting is a social ritual. '.repeat(40)],
    ])(
      'shows the prepared welcome when the model answers %s',
      async (_, strayed) => {
        openChat();
        mockInstance.generate.mockResolvedValueOnce(strayed);

        await useLLMStore
          .getState()
          .sendChatMessage('Hi!', 1, noSources, settings);

        expect(mockPersistMessage).toHaveBeenCalledWith(
          mockDb,
          expect.objectContaining({
            role: 'assistant',
            content: OPENING_WELCOMES.en,
          })
        );
      }
    );

    it('answers a greeting in the language it came in', async () => {
      openChat();
      mockInstance.generate.mockResolvedValueOnce(OPENING_WELCOMES.en);

      await useLLMStore
        .getState()
        .sendChatMessage('cześć', 1, noSources, settings);

      expect(useLLMStore.getState().activeChatMessages.at(-1)).toEqual(
        expect.objectContaining({
          role: 'assistant',
          content: OPENING_WELCOMES.pl,
        })
      );
    });

    it('keeps the greeting a welcome opens with, though the user wrote the same word', async () => {
      openChat();
      const polishWelcome =
        'Cześć! Jestem prywatnym asystentem działającym na Twoim telefonie.\n\n' +
        '- Wyjaśnię temat\n- Napiszę wiadomość\n- Streszczę dokument\n\n' +
        'Od czego zaczynamy?';
      mockInstance.generate.mockResolvedValueOnce(polishWelcome);

      await useLLMStore
        .getState()
        .sendChatMessage('cześć', 1, noSources, settings);

      expect(mockPersistMessage).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ role: 'assistant', content: polishWelcome })
      );
      expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
        polishWelcome
      );
    });

    describe('by model size', () => {
      const openChatWith = (parameters: number | undefined) =>
        useLLMStore.setState({
          model: { ...baseModel, parameters },
          activeChatId: 1,
          activeChatMessages: [],
        });

      it('hands a model under 0.6 billion parameters the prepared welcome without generating', async () => {
        openChatWith(0.49);
        mockInstance.generate.mockClear();

        await useLLMStore
          .getState()
          .sendChatMessage('cześć', 1, noSources, settings);

        expect(mockInstance.generate).not.toHaveBeenCalled();
        expect(useLLMStore.getState().activeChatMessages.at(-1)).toEqual(
          expect.objectContaining({
            role: 'assistant',
            content: OPENING_WELCOMES.pl,
          })
        );
        expect(mockPersistMessage).toHaveBeenCalledWith(
          mockDb,
          expect.objectContaining({ content: OPENING_WELCOMES.pl })
        );
      });

      it('finishes the turn cleanly, with no performance figures to show', async () => {
        openChatWith(0.49);

        await useLLMStore
          .getState()
          .sendChatMessage('Hi!', 1, noSources, settings);

        const state = useLLMStore.getState();
        expect(state.isGenerating).toBe(false);
        expect(state.isProcessingPrompt).toBe(false);
        expect(state.activeChatMessages.at(-1)?.tokensPerSecond).toBe(0);
      });

      it.each([0.75, 2.03])(
        'lets a %s billion parameter model write the welcome',
        async (parameters) => {
          openChatWith(parameters);
          mockInstance.generate.mockResolvedValueOnce(modelWelcome);

          await useLLMStore
            .getState()
            .sendChatMessage('Hi!', 1, noSources, settings);

          expect(mockInstance.generate).toHaveBeenCalled();
          expect(
            useLLMStore.getState().activeChatMessages.at(-1)?.content
          ).toBe(modelWelcome);
        }
      );

      it('lets a model of unknown size write the welcome', async () => {
        openChatWith(undefined);
        mockInstance.generate.mockResolvedValueOnce(modelWelcome);

        await useLLMStore
          .getState()
          .sendChatMessage('Hi!', 1, noSources, settings);

        expect(mockInstance.generate).toHaveBeenCalled();
      });
    });

    it('leaves a welcome the user stopped as they left it', async () => {
      openChat();
      mockInstance.generate.mockImplementationOnce(async () => {
        useLLMStore.getState().interrupt();
        return 'Hel';
      });

      await useLLMStore
        .getState()
        .sendChatMessage('Hi!', 1, noSources, settings);

      expect(mockPersistMessage).not.toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ content: OPENING_WELCOMES.en })
      );
    });

    it('gives no example once the first message carries a task', async () => {
      openChat();

      await useLLMStore
        .getState()
        .sendChatMessage('hi, what is 6 times 7?', 1, noSources, settings);

      expect(promptOptions().openingWelcome).toBeUndefined();
    });

    it('gives no example when the conversation is already under way', async () => {
      openChat(earlierTurn);

      await useLLMStore
        .getState()
        .sendChatMessage('hi', 1, noSources, settings);

      expect(promptOptions().openingWelcome).toBeUndefined();
    });

    it('gives no example when the greeting comes with an image', async () => {
      openChat();

      await useLLMStore
        .getState()
        .sendChatMessage('hi', 1, noSources, settings, 'file://photo.jpg');

      expect(promptOptions().openingWelcome).toBeUndefined();
    });

    it('gives no example when the user has written their own instructions', async () => {
      openChat();
      useSettingsStore.setState({ customSystemPrompt: 'You are a pirate.' });

      await useLLMStore
        .getState()
        .sendChatMessage('hi', 1, noSources, settings);

      expect(promptOptions().openingWelcome).toBeUndefined();
    });
  });

  it('saves the question before the model has finished loading, so a killed app keeps it', async () => {
    let finishLoad!: () => void;
    const loadGate = new Promise<void>((resolve) => {
      finishLoad = resolve;
    });
    mockLLMModule.fromModelName.mockImplementationOnce(async (...args) => {
      capturedTokenCallback = args[2];
      await loadGate;
      return mockInstance as unknown as LLMModule;
    });
    const reload = useLLMStore.getState().loadModel(baseModel, true);
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    const turn = useLLMStore
      .getState()
      .sendChatMessage('Tell me about the moon', 1, noSources, settings);
    await flushFrame();

    expect(mockPersistMessage).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        role: 'user',
        content: 'Tell me about the moon',
      })
    );

    finishLoad();
    await reload;
    await turn;
    expect(
      mockPersistMessage.mock.calls.filter(
        ([, message]) => message.role === 'user'
      )
    ).toHaveLength(1);
  });

  it('persists user message and assistant response', async () => {
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('ping', 1, noSources, settings);

    expect(mockPersistMessage).toHaveBeenCalledTimes(2);
    expect(mockPersistMessage).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ role: 'user', content: 'ping' })
    );
    expect(mockPersistMessage).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        role: 'assistant',
        content: 'The answer is 42.',
      })
    );
  });

  it('keeps the user message when the turn is stopped while a model load is in flight', async () => {
    let finishLoad!: () => void;
    const loadGate = new Promise<void>((resolve) => {
      finishLoad = resolve;
    });
    mockLLMModule.fromModelName.mockImplementationOnce(async (...args) => {
      capturedTokenCallback = args[2];
      await loadGate;
      return mockInstance as unknown as LLMModule;
    });

    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    const switching = useLLMStore
      .getState()
      .loadModel({ ...baseModel, id: 2, modelName: 'Other LLM' });
    const send = useLLMStore
      .getState()
      .sendChatMessage('ping', 1, noSources, settings);
    await flushFrame();

    useLLMStore.getState().interrupt();
    finishLoad();
    await switching;
    await send;

    expect(mockPersistMessage).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ role: 'user', content: 'ping' })
    );
    expect(
      useLLMStore
        .getState()
        .activeChatMessages.some(
          (message) => message.role === 'user' && message.content === 'ping'
        )
    ).toBe(true);
  });

  it('does not wait for the model load to finish before saying the turn was stopped', async () => {
    let finishLoad!: () => void;
    const loadGate = new Promise<void>((resolve) => {
      finishLoad = resolve;
    });
    mockLLMModule.fromModelName.mockImplementationOnce(async (...args) => {
      capturedTokenCallback = args[2];
      await loadGate;
      return mockInstance as unknown as LLMModule;
    });

    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    const switching = useLLMStore
      .getState()
      .loadModel({ ...baseModel, id: 2, modelName: 'Other LLM' });
    const send = useLLMStore
      .getState()
      .sendChatMessage('ping', 1, noSources, settings);
    await flushFrame();

    useLLMStore.getState().interrupt();
    await send;

    expect(mockMarkMessageStopped).toHaveBeenCalledWith(mockDb, 42);

    finishLoad();
    await switching;
  });

  it('marks the stopped turn so the chat can say it was stopped', async () => {
    let finishLoad!: () => void;
    const loadGate = new Promise<void>((resolve) => {
      finishLoad = resolve;
    });
    mockLLMModule.fromModelName.mockImplementationOnce(async (...args) => {
      capturedTokenCallback = args[2];
      await loadGate;
      return mockInstance as unknown as LLMModule;
    });

    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    const switching = useLLMStore
      .getState()
      .loadModel({ ...baseModel, id: 2, modelName: 'Other LLM' });
    const send = useLLMStore
      .getState()
      .sendChatMessage('ping', 1, noSources, settings);
    await flushFrame();

    useLLMStore.getState().interrupt();
    finishLoad();
    await switching;
    await send;

    expect(mockMarkMessageStopped).toHaveBeenCalledWith(mockDb, 42);
    expect(
      useLLMStore
        .getState()
        .activeChatMessages.find((message) => message.role === 'user')
        ?.stoppedByUser
    ).toBe(true);
  });

  it('ends the turn at once when the stop lands while sources are still being gathered', async () => {
    let releaseSources!: () => void;
    const sourcesInFlight = async () => {
      await new Promise<void>((resolve) => {
        releaseSources = resolve;
      });
      return {
        context: [] as string[],
        sourceDocuments: [],
        preferredSourceDocuments: [],
      };
    };

    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    const send = useLLMStore
      .getState()
      .sendChatMessage('ping', 1, sourcesInFlight, settings);
    await flushFrame();

    useLLMStore.getState().interrupt();
    await send;

    expect(mockMarkMessageStopped).toHaveBeenCalledWith(mockDb, 42);
    expect(
      useLLMStore
        .getState()
        .activeChatMessages.find((message) => message.role === 'user')
        ?.stoppedByUser
    ).toBe(true);
    expect(useLLMStore.getState().retryArmedForChatId).toBe(1);

    releaseSources();
  });

  it('drops the stopped mark when the retry starts, not when it finishes', async () => {
    let releaseSources!: () => void;
    const sourcesInFlight = async () => {
      await new Promise<void>((resolve) => {
        releaseSources = resolve;
      });
      return {
        context: [] as string[],
        sourceDocuments: [],
        preferredSourceDocuments: [],
      };
    };

    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    const send = useLLMStore
      .getState()
      .sendChatMessage('ping', 1, sourcesInFlight, settings);
    await flushFrame();
    useLLMStore.getState().interrupt();
    await send;
    releaseSources();

    const stoppedQuestion = () =>
      useLLMStore
        .getState()
        .activeChatMessages.find((message) => message.role === 'user')
        ?.stoppedByUser;
    expect(stoppedQuestion()).toBe(true);

    const retry = useLLMStore.getState().retryLastGeneration();
    await flushFrame();

    expect(mockMarkMessageStopped).toHaveBeenLastCalledWith(mockDb, 42, false);
    expect(stoppedQuestion()).toBe(false);

    releaseSources();
    await retry;
  });

  it('marks the answer the user stopped mid-stream', async () => {
    let finishGeneration!: (response: string) => void;
    mockInstance.generate.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finishGeneration = resolve;
        })
    );

    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    const send = useLLMStore
      .getState()
      .sendChatMessage('ping', 1, noSources, settings);
    await flushFrame();

    useLLMStore.getState().interrupt();
    finishGeneration('The Roman Empire was');
    await send;

    expect(mockPersistMessage).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ role: 'assistant', stoppedByUser: true })
    );
    expect(
      useLLMStore
        .getState()
        .activeChatMessages.find((message) => message.role === 'assistant')
        ?.stoppedByUser
    ).toBe(true);
  });

  it('sets isProcessingPrompt at start and clears it on complete', async () => {
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('ping', 1, noSources, settings);

    expect(useLLMStore.getState().isProcessingPrompt).toBe(false);
    expect(useLLMStore.getState().isGenerating).toBe(false);
  });

  it('clears the live web trace when generation fails before any token', async () => {
    mockInstance.generate
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'));
    useWebSearchStore.getState().pushWebSearchEvent({ type: 'objectives' });
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('ping', 1, noSources, settings);

    expect(useWebSearchStore.getState().webSearchTrace).toEqual([]);
    expect(
      useLLMStore.getState().activeChatMessages.map((m) => m.role)
    ).toEqual(['user']);
  });

  it('adds user message and assistant placeholder to activeChatMessages before generating', async () => {
    let messagesBeforeGenerate: Message[] = [];
    let captured = false;
    mockInstance.generate.mockImplementation(async () => {
      if (!captured) {
        captured = true;
        messagesBeforeGenerate = useLLMStore.getState().activeChatMessages;
      }
      return 'response';
    });
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('ping', 1, noSources, settings);

    expect(messagesBeforeGenerate).toHaveLength(2);
    expect(messagesBeforeGenerate[0].role).toBe('user');
    expect(messagesBeforeGenerate[1].role).toBe('assistant');
    expect(messagesBeforeGenerate[1].content).toBe('');
  });

  it('replaces assistant placeholder with persisted message id after generation', async () => {
    mockPersistMessage.mockResolvedValueOnce(41).mockResolvedValueOnce(42);
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('ping', 1, noSources, settings);

    const messages = useLLMStore.getState().activeChatMessages;
    expect(messages).toHaveLength(2);
    expect(messages[0].id).toBe(41);
    expect(messages[1]).toEqual(
      expect.objectContaining({
        id: 42,
        role: 'assistant',
        content: 'The answer is 42.',
      })
    );
  });

  it('recovers gracefully when generation returns null', async () => {
    mockInstance.generate.mockResolvedValue(null);
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('ping', 1, noSources, settings);

    expect(useLLMStore.getState().isGenerating).toBe(false);
    expect(useLLMStore.getState().isProcessingPrompt).toBe(false);
    // Only user message persisted, not assistant (no response)
    expect(mockPersistMessage).toHaveBeenCalledTimes(1);
  });

  it('recovers gracefully when an exception is thrown during generation', async () => {
    mockInstance.generate.mockRejectedValue(new Error('GPU crash'));
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('ping', 1, noSources, settings);

    expect(useLLMStore.getState().isGenerating).toBe(false);
    expect(useLLMStore.getState().isProcessingPrompt).toBe(false);
    expect(useLLMStore.getState().generationError).toEqual({
      chatId: 1,
      message: 'Failed to generate a response.',
    });
    expect(mockInstance.delete).toHaveBeenCalled();
  });

  it('retries a failed generation without persisting the user message twice', async () => {
    mockPersistMessage.mockResolvedValueOnce(41).mockResolvedValueOnce(42);
    mockInstance.generate
      .mockRejectedValueOnce(new Error('out of memory'))
      .mockRejectedValueOnce(new Error('out of memory'))
      .mockResolvedValueOnce(WARMUP_REPLY)
      .mockResolvedValueOnce('Recovered answer');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('ping', 1, noSources, settings);
    expect(mockPersistMessage).toHaveBeenCalledTimes(1);

    await useLLMStore.getState().retryLastGeneration();

    expect(mockPersistMessage).toHaveBeenCalledTimes(2);
    expect(
      mockPersistMessage.mock.calls.filter(
        ([, message]) => message.role === 'user'
      )
    ).toHaveLength(1);
    expect(useLLMStore.getState().generationError).toBeNull();
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      'Recovered answer'
    );
  });

  it('retries once with a continuation nudge when the model produces a dangling list, then persists the combined answer', async () => {
    mockInstance.generate
      .mockResolvedValueOnce('Oto co warto zabrać:')
      .mockResolvedValueOnce('- Paszport\n- Bilet lotniczy')
      .mockResolvedValue('');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('co zabrać do samolotu?', 1, noSources, settings);

    expect(mockInstance.generate).toHaveBeenCalledTimes(3);
    expect(useLLMStore.getState().generationError).toBeNull();
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      'Oto co warto zabrać:\n- Paszport\n- Bilet lotniczy'
    );
  });

  it('shows what it has rather than a banner when the continuation retry is still a dangling list', async () => {
    mockInstance.generate
      .mockResolvedValueOnce('Oto co warto zabrać:')
      .mockResolvedValueOnce('Oto lista:');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('co zabrać do samolotu?', 1, noSources, settings);

    expect(mockInstance.generate).toHaveBeenCalledTimes(3);
    expect(useLLMStore.getState().generationError).toBeNull();
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toContain(
      'Oto co warto zabrać:'
    );
  });

  it('keeps the original dangling text when the continuation nudge returns nothing', async () => {
    mockInstance.generate
      .mockResolvedValueOnce('Oto co warto zabrać:')
      .mockResolvedValueOnce('   ');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('co zabrać do samolotu?', 1, noSources, settings);

    expect(mockInstance.generate).toHaveBeenCalledTimes(3);
    expect(useLLMStore.getState().generationError).toBeNull();
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      'Oto co warto zabrać:'
    );
  });

  it('keeps the first answer instead of failing the turn when the continuation nudge throws, e.g. on a prompt past the context window', async () => {
    mockInstance.generate
      .mockResolvedValueOnce('Oto co warto zabrać:')
      .mockRejectedValueOnce(new Error('prompt exceeds the context window'))
      .mockResolvedValue('');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('co zabrać do samolotu?', 1, noSources, settings);

    expect(useLLMStore.getState().generationError).toBeNull();
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      'Oto co warto zabrać:'
    );
  });

  it('anchors the continuation nudge to the conversation language and continues from the dangling text', async () => {
    mockInstance.generate
      .mockResolvedValueOnce('Oto co warto zabrać:')
      .mockResolvedValueOnce('- Paszport');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('co zabrać do samolotu?', 1, noSources, settings);

    const continuationMessages = mockInstance.generate.mock.calls[1][0];
    const lastMessage = continuationMessages[continuationMessages.length - 1];
    const echoedAssistantTurn =
      continuationMessages[continuationMessages.length - 2];

    expect(echoedAssistantTurn).toEqual({
      role: 'assistant',
      content: 'Oto co warto zabrać:',
    });
    expect(lastMessage.role).toBe('user');
    expect(lastMessage.content).toContain(
      'Continue now with ONLY the actual list items'
    );
    expect(lastMessage.content).toContain(
      '(Answer in the same language as this message.)'
    );
  });

  it('spends the echo nudge, not the list nudge, when the reply is both', async () => {
    mockInstance.generate
      .mockResolvedValueOnce('Co zabrać do samolotu?:')
      .mockResolvedValueOnce('Zabierz paszport, bilet i ładowarkę.');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('Co zabrać do samolotu?', 1, noSources, settings);

    const nudge = mockInstance.generate.mock.calls[1]![0] as {
      role: string;
      content: string;
    }[];
    expect(nudge.at(-1)!.content).toContain('only repeated the question back');
    expect(nudge.at(-1)!.content).not.toContain('ONLY the actual list items');
    expect(useLLMStore.getState().generationError).toBeNull();
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      'Zabierz paszport, bilet i ładowarkę.'
    );
  });

  it('nudges for the language, not the dangling list, when the answer drifted language (live-found)', async () => {
    const question = 'Kim był Kazimierz Wielki i czego dokonał?';
    const wrongLanguageDanglingAnswer =
      "Kazimierz Wielki (1310–1370) Polska'nın en son piastıydı. İşte maddeler:";
    mockInstance.generate
      .mockResolvedValueOnce(wrongLanguageDanglingAnswer)
      .mockResolvedValueOnce(
        'Kazimierz Wielki był królem Polski i zreformował prawo.'
      );
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage(question, 1, noSources, settings);

    const nudge = mockInstance.generate.mock.calls[1]![0] as {
      role: string;
      content: string;
    }[];
    expect(nudge.at(-1)!.content).toContain('written in the wrong language');
    expect(nudge.at(-1)!.content).not.toContain('ONLY the actual list items');
    expect(useLLMStore.getState().generationError).toBeNull();
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      'Kazimierz Wielki był królem Polski i zreformował prawo.'
    );
  });

  it('spends one nudge and then keeps the answer rather than losing the turn (live-found)', async () => {
    const question = 'Kim był Kazimierz Wielki i czego dokonał?';
    const turkish =
      "Kazimierz Wielki (1310–1370) Polska'nın en son piastıydı. İşte maddeler:";
    mockInstance.generate
      .mockResolvedValueOnce(turkish)
      .mockResolvedValueOnce(turkish);
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage(question, 1, noSources, settings);

    expect(mockInstance.generate).toHaveBeenCalledTimes(3);
    expect(useLLMStore.getState().generationError).toBeNull();
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      turkish
    );
  });

  it('still generates a conversation digest after recovering via the continuation nudge', async () => {
    mockInstance.generate
      .mockResolvedValueOnce('Oto co warto zabrać:')
      .mockResolvedValueOnce('- Paszport\n- Bilet lotniczy')
      .mockResolvedValueOnce('Trip to London packing list.');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
      activeChatDigest: null,
    });

    await useLLMStore
      .getState()
      .sendChatMessage('co zabrać do samolotu?', 1, noSources, settings);
    await flushFrame();

    expect(mockInstance.generate).toHaveBeenCalledTimes(3);
    expect(useLLMStore.getState().activeChatDigest).toBe(
      'Trip to London packing list.'
    );
  });

  it('retries once when the model only talks about its sources, instead of failing', async () => {
    mockInstance.generate
      .mockResolvedValueOnce(
        'Dane pochodzą ze źródeł wyżej. Źródła to opisują, szczegóły są w źródłach.'
      )
      .mockResolvedValueOnce('Cena wynosi 3200 zł.')
      .mockResolvedValue('');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('ile kosztuje?', 1, noSources, settings);

    const nudge = mockInstance.generate.mock.calls[1]![0] as {
      role: string;
      content: string;
    }[];
    expect(nudge.at(-1)!.content).toContain('only talked about the sources');
    expect(useLLMStore.getState().generationError).toBeNull();
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      'Cena wynosi 3200 zł.'
    );
  });

  it('shows the reply rather than destroying the turn when the circular retry does not help (live-found)', async () => {
    const circular =
      'Dane pochodzą ze źródeł wyżej. Źródła to opisują, szczegóły są w źródłach.';
    mockInstance.generate.mockResolvedValue(circular);
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('ile kosztuje?', 1, noSources, settings);

    expect(mockInstance.generate).toHaveBeenCalledTimes(3);
    expect(useLLMStore.getState().generationError).toBeNull();
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      circular
    );
  });

  it('keeps a well-cited answer that names its sources by number (live-found)', async () => {
    const cited =
      'Source 1 lists 162 g, Source 2 lists 146.9 x 70.5 x 7.2 mm, and Source 3 agrees.';
    mockInstance.generate.mockResolvedValue(cited);
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage(
        'What are the dimensions and weight?',
        1,
        noSources,
        settings
      );

    expect(mockInstance.generate).toHaveBeenCalledTimes(2);
    expect(useLLMStore.getState().generationError).toBeNull();
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      cited
    );
  });

  it('retries once when the answer buries the figure the sources offer, and keeps a retry that states it (smoke T2)', async () => {
    const passage =
      'Warszawa z populacją 1,86 miliona mieszkańców jest ósmym co do wielkości miastem w Unii Europejskiej.';
    (prepareMessagesForLLM as jest.Mock).mockReturnValueOnce([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: `${passage}\n\nJaka jest populacja Warszawy?` },
    ]);
    const digest =
      'Źródła nie podają jednej, ostatecznej liczby populacji Warszawy. Mazowieckietg.pl pisze, że Warszawa z populacją 1,86 miliona mieszkańców jest ósmym miastem Unii.';
    mockInstance.generate
      .mockResolvedValueOnce(
        'Zgodnie z dostępnymi źródłami nie jest podana konkretna liczba ludności Warszawy.'
      )
      .mockResolvedValueOnce(digest)
      .mockResolvedValue('');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });
    const factSources = async () => ({
      ...(await noSources()),
      webIntentKind: 'fact' as const,
    });

    await useLLMStore
      .getState()
      .sendChatMessage(
        'Jaka jest populacja Warszawy?',
        1,
        factSources,
        settings
      );

    const nudge = mockInstance.generate.mock.calls[1]![0] as {
      role: string;
      content: string;
    }[];
    expect(nudge.at(-1)!.content).toContain('first sentence');
    expect(nudge.at(-1)!.content).toContain('1,86 miliona');
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      digest
    );
  });

  it('judges the draft against the sources block only, not the question or the hints', async () => {
    const question = 'Ile to jest 2500 EUR w złotych?';
    (prepareMessagesForLLM as jest.Mock).mockReturnValueOnce([
      { role: 'system', content: 'You are helpful.' },
      {
        role: 'user',
        content: `<sources>\n --- Source 1: Kantor --- \n Kantor czynny codziennie. \n --- End of Source 1 ---\n</sources>\n\nFigures found in the sources: 2500 EUR\n${question}`,
      },
    ]);
    mockInstance.generate
      .mockResolvedValueOnce('Źródła nie podają kursu euro.')
      .mockResolvedValue('');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });
    const priceSources = async () => ({
      ...(await noSources()),
      webIntentKind: 'price' as const,
    });

    await useLLMStore
      .getState()
      .sendChatMessage(question, 1, priceSources, settings);

    const prompts = mockInstance.generate.mock.calls.map((call) =>
      JSON.stringify(call[0])
    );
    expect(
      prompts.some((prompt) => prompt.includes('does contain a figure'))
    ).toBe(false);
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      'Źródła nie podają kursu euro.'
    );
  });

  it('retries a refusal that names the model code and quotes the spec line holding the figure (release R-16)', async () => {
    const question = 'Jaką częstotliwość odświeżania ma Samsung QE65QN90D?';
    const specLine =
      "Przekątna ekranu w calach 65'' Format HD 4K Ultra HD Rozdzielczość 3840 x 2160 Częstotliwość odświeżania 144 Hz Tuner Analogowe , DVB-C , DVB-S2 , DVB-T2 (HEVC) Technologia HDR HDR10+ , HLG Tryb gra Dla graczy Smart TV Tizen Wi-Fi Bluetooth HDMI 4 USB 2 Klasa energetyczna G Waga 25 kg";
    (prepareMessagesForLLM as jest.Mock).mockReturnValueOnce([
      { role: 'system', content: 'You are helpful.' },
      {
        role: 'user',
        content: `\n --- Source 1: Telewizor Samsung QE65QN90D QLED 65'' 4K Ultra HD Tizen --- \n ${specLine} \n --- End of Source 1 ---\n\n${question}`,
      },
    ]);
    const answer = 'Samsung QE65QN90D ma częstotliwość odświeżania 144 Hz.';
    mockInstance.generate
      .mockResolvedValueOnce(
        'Częstotliwość odświeżania telewizora Samsung QE65QN90D nie jest podana w dostarczonych źródłach.'
      )
      .mockResolvedValueOnce(answer)
      .mockResolvedValue('');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });
    const specsSources = async () => ({
      ...(await noSources()),
      webIntentKind: 'specs' as const,
    });

    await useLLMStore
      .getState()
      .sendChatMessage(question, 1, specsSources, settings);

    const nudge = mockInstance.generate.mock.calls[1]![0] as {
      role: string;
      content: string;
    }[];
    expect(nudge.map((message) => message.role)).toEqual(['system', 'user']);
    expect(nudge[0]!.content).toBe('Answer from the quoted lines.');
    expect(nudge.at(-1)!.content).toContain('quoted from the sources');
    expect(nudge.at(-1)!.content).toContain('144 Hz');
    expect(nudge.at(-1)!.content).toContain(question);
    expect(nudge.at(-1)!.content).not.toContain('Klasa energetyczna');
    expect(nudge.at(-1)!.content).not.toContain('--- Source 1');
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      answer
    );
  });

  it('retries once when the answer skips a sub-query the sources cover, naming that part', async () => {
    (prepareMessagesForLLM as jest.Mock).mockReturnValueOnce([
      { role: 'system', content: 'You are helpful.' },
      {
        role: 'user',
        content:
          'Kurs bitcoina wynosi dziś 98 000 USD. Kurs ethereum wynosi dziś 3 200 USD.\n\nporównaj kurs bitcoina i ethereum',
      },
    ]);
    const complete =
      'Bitcoin kosztuje około 98 000 USD, a ethereum około 3 200 USD.';
    mockInstance.generate
      .mockResolvedValueOnce(
        'Bitcoin kosztuje obecnie około 98 000 USD i od tygodnia zyskuje na wartości.'
      )
      .mockResolvedValueOnce(complete)
      .mockResolvedValue('');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });
    const withSubQueries = async () => ({
      ...(await noSources()),
      webSubQueries: ['kurs bitcoin', 'kurs ethereum'],
    });

    await useLLMStore
      .getState()
      .sendChatMessage(
        'porównaj kurs bitcoina i ethereum',
        1,
        withSubQueries,
        settings
      );

    const nudge = mockInstance.generate.mock.calls[1]![0] as {
      role: string;
      content: string;
    }[];
    expect(nudge.at(-1)!.content).toContain(
      'does not address: "kurs ethereum"'
    );
    expect(useLLMStore.getState().generationError).toBeNull();
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      complete
    );
  });

  it('keeps the first answer when the refining pass comes back with none of its figures (Pixel: "po refiningu 1 linijka")', async () => {
    (prepareMessagesForLLM as jest.Mock).mockReturnValueOnce([
      { role: 'system', content: 'You are helpful.' },
      {
        role: 'user',
        content:
          'Kurs bitcoina wynosi dziś 98 000 USD. Kurs ethereum wynosi dziś 3 200 USD.\n\nporównaj kurs bitcoina i ethereum',
      },
    ]);
    const detailed =
      'Bitcoin kosztuje obecnie około 98 000 USD i od tygodnia zyskuje na wartości, ' +
      'notując najwyższy poziom od miesięcy. Wolumen obrotu również rośnie.';
    const thin = 'Kursy obu kryptowalut różnią się.';
    mockInstance.generate
      .mockResolvedValueOnce(detailed)
      .mockResolvedValueOnce(thin)
      .mockResolvedValue('');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });
    const withSubQueries = async () => ({
      ...(await noSources()),
      webSubQueries: ['kurs bitcoin', 'kurs ethereum'],
    });

    await useLLMStore
      .getState()
      .sendChatMessage(
        'porównaj kurs bitcoina i ethereum',
        1,
        withSubQueries,
        settings
      );

    const nudge = mockInstance.generate.mock.calls[1]![0] as {
      role: string;
      content: string;
    }[];
    expect(nudge.at(-1)!.content).toContain(
      'does not address: "kurs ethereum"'
    );
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      detailed
    );
  });

  it('keeps the first answer on screen while a nudge retry generates, then swaps once', async () => {
    (prepareMessagesForLLM as jest.Mock).mockReturnValueOnce([
      { role: 'system', content: 'You are helpful.' },
      {
        role: 'user',
        content:
          'Kurs bitcoina wynosi dziś 98 000 USD. Kurs ethereum wynosi dziś 3 200 USD.\n\nporównaj kurs bitcoina i ethereum',
      },
    ]);
    const partial =
      'Bitcoin kosztuje obecnie około 98 000 USD i od tygodnia zyskuje na wartości.';
    const complete =
      'Bitcoin kosztuje około 98 000 USD, a ethereum około 3 200 USD.';
    const seenDuringRetry: { content?: string; isRefining: boolean }[] = [];
    mockInstance.generate
      .mockImplementationOnce(async () => {
        capturedTokenCallback!(partial);
        await flushFrame();
        return partial;
      })
      .mockImplementationOnce(async () => {
        capturedTokenCallback!('Bitcoin kosztuje');
        capturedTokenCallback!(' około 98 000 USD, a ethereum');
        await flushFrame();
        seenDuringRetry.push({
          content: useLLMStore.getState().activeChatMessages.at(-1)?.content,
          isRefining: useLLMStore.getState().isRefining,
        });
        return complete;
      })
      .mockResolvedValue('');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });
    const withSubQueries = async () => ({
      ...(await noSources()),
      webSubQueries: ['kurs bitcoin', 'kurs ethereum'],
    });

    await useLLMStore
      .getState()
      .sendChatMessage(
        'porównaj kurs bitcoina i ethereum',
        1,
        withSubQueries,
        settings
      );

    expect(seenDuringRetry).toEqual([{ content: partial, isRefining: true }]);
    expect(useLLMStore.getState().isRefining).toBe(false);
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      complete
    );
  });

  it('stops refining even when the retry generation throws', async () => {
    (prepareMessagesForLLM as jest.Mock).mockReturnValueOnce([
      { role: 'system', content: 'You are helpful.' },
      {
        role: 'user',
        content:
          'Kurs bitcoina wynosi dziś 98 000 USD. Kurs ethereum wynosi dziś 3 200 USD.\n\nporównaj kurs bitcoina i ethereum',
      },
    ]);
    mockInstance.generate
      .mockResolvedValueOnce(
        'Bitcoin kosztuje obecnie około 98 000 USD i od tygodnia zyskuje na wartości.'
      )
      .mockRejectedValueOnce(new Error('interrupted'))
      .mockResolvedValue('');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });
    const withSubQueries = async () => ({
      ...(await noSources()),
      webSubQueries: ['kurs bitcoin', 'kurs ethereum'],
    });

    await useLLMStore
      .getState()
      .sendChatMessage(
        'porównaj kurs bitcoina i ethereum',
        1,
        withSubQueries,
        settings
      );

    expect(useLLMStore.getState().isRefining).toBe(false);
    expect(useLLMStore.getState().isGenerating).toBe(false);
    expect(useLLMStore.getState().generationError).toBeNull();
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      'Bitcoin kosztuje obecnie około 98 000 USD i od tygodnia zyskuje na wartości.'
    );
  });

  it('keeps the first answer when the coverage retry still skips the aspect', async () => {
    (prepareMessagesForLLM as jest.Mock).mockReturnValueOnce([
      { role: 'system', content: 'You are helpful.' },
      {
        role: 'user',
        content:
          'Kurs bitcoina wynosi dziś 98 000 USD. Kurs ethereum wynosi dziś 3 200 USD.\n\nporównaj kurs bitcoina i ethereum',
      },
    ]);
    const partial =
      'Bitcoin kosztuje obecnie około 98 000 USD i od tygodnia zyskuje na wartości.';
    mockInstance.generate
      .mockResolvedValueOnce(partial)
      .mockResolvedValueOnce(
        'Bitcoin wciąż kosztuje około 98 000 USD i dalej zyskuje na wartości.'
      )
      .mockResolvedValue('');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });
    const withSubQueries = async () => ({
      ...(await noSources()),
      webSubQueries: ['kurs bitcoin', 'kurs ethereum'],
    });

    await useLLMStore
      .getState()
      .sendChatMessage(
        'porównaj kurs bitcoina i ethereum',
        1,
        withSubQueries,
        settings
      );

    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      partial
    );
  });

  it('retries once when the model echoes the question back, instead of failing the turn', async () => {
    mockInstance.generate
      .mockResolvedValueOnce('co zabrać do samolotu?')
      .mockResolvedValueOnce(
        'Zabierz paszport, bilet, ładowarkę i lekką kurtkę.'
      )
      .mockResolvedValue('');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('co zabrać do samolotu?', 1, noSources, settings);

    expect(useLLMStore.getState().generationError).toBeNull();
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      'Zabierz paszport, bilet, ładowarkę i lekką kurtkę.'
    );
  });

  it('says plainly there is no answer instead of echoing the question back (live-found)', async () => {
    mockInstance.generate.mockResolvedValue('co zabrać do samolotu?');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('co zabrać do samolotu?', 1, noSources, settings);

    expect(mockInstance.generate).toHaveBeenCalledTimes(3);
    expect(useLLMStore.getState().generationError).toBeNull();
    const shown = useLLMStore.getState().activeChatMessages.at(-1)?.content;
    expect(shown).not.toBe('co zabrać do samolotu?');
    expect(shown).toContain('Nie udało mi się na to odpowiedzieć');
  });

  it('never shows the language instruction the app added to the question when the model repeats it', async () => {
    mockInstance.generate.mockResolvedValue(
      'Pack a passport and a charger. (Answer in the same language as this message.)'
    );
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage(
        'what should I pack for a flight?',
        1,
        noSources,
        settings
      );

    const shown = useLLMStore.getState().activeChatMessages.at(-1)?.content;
    expect(shown).toBe('Pack a passport and a charger.');
  });

  it('never shows the attachment hint the app added to the prompt when the model repeats it (A-70)', async () => {
    mockInstance.generate.mockResolvedValue(
      'The question is about the just-attached document(s) in the <sources> above. The amount for a monthly pass is 49 USD.'
    );
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage(
        'How much does a monthly pass cost?',
        1,
        noSources,
        settings
      );

    const shown = useLLMStore.getState().activeChatMessages.at(-1)?.content;
    expect(shown).toBe('The amount for a monthly pass is 49 USD.');
  });

  it('blames the sources only when the answer had sources to work from', async () => {
    mockInstance.generate.mockResolvedValue('co zabrać do samolotu?');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });
    const withSources = async () => ({
      ...(await noSources()),
      context: ['Pasażer może zabrać jeden bagaż podręczny do 8 kg.'],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('co zabrać do samolotu?', 1, withSources, settings);

    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toContain(
      'na podstawie znalezionych źródeł'
    );
  });

  it('gives the no-answer line in the language of the question', async () => {
    mockInstance.generate.mockResolvedValue('what should I pack for a flight?');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage(
        'what should I pack for a flight?',
        1,
        noSources,
        settings
      );

    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toContain(
      "couldn't answer that"
    );
  });

  it('fails the turn when the model produces only a think block (live-found)', async () => {
    mockInstance.generate.mockResolvedValue('<think>\n\n</think>');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('co zabrać do samolotu?', 1, noSources, settings);

    expect(useLLMStore.getState().generationError).toEqual({
      chatId: 1,
      message: 'Failed to generate a response.',
    });
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).not.toBe(
      '<think>\n\n</think>'
    );
  });

  it('lets the previous turn finish its digest before the next turn touches the model', async () => {
    let releaseDigest: (value: string) => void = () => {};
    mockInstance.generate
      .mockResolvedValueOnce('First answer with enough words to digest.')
      .mockImplementationOnce(
        () => new Promise<string>((resolve) => (releaseDigest = resolve))
      )
      .mockResolvedValueOnce('Second answer.')
      .mockResolvedValue('');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('first question please', 1, noSources, settings);
    await flushFrame();
    expect(mockInstance.generate).toHaveBeenCalledTimes(2);

    const second = useLLMStore
      .getState()
      .sendChatMessage('second question please', 1, noSources, settings);
    await flushFrame();
    expect(mockInstance.generate).toHaveBeenCalledTimes(2);

    releaseDigest('a digest');
    await second;
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      'Second answer.'
    );
  });

  it('keeps the model loaded when the user stops during the web search', async () => {
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });
    const stoppedSearch = async () => {
      useLLMStore.getState().interrupt();
      throw new Error('Web search aborted');
    };

    await useLLMStore
      .getState()
      .sendChatMessage('cena rtx 5080', 1, stoppedSearch, settings);

    expect(mockInstance.delete).not.toHaveBeenCalled();
    expect(mockInstance.generate).not.toHaveBeenCalled();
    expect(useLLMStore.getState().generationError).toBeNull();
    expect(useLLMStore.getState().isProcessingPrompt).toBe(false);
  });

  it('persists a stopped draft as it is, without any refinement', async () => {
    mockInstance.generate.mockImplementationOnce(async () => {
      useLLMStore.getState().interrupt();
      return 'Here are the options:';
    });
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('what are my options?', 1, noSources, settings);

    const prompts = mockInstance.generate.mock.calls.map((call) =>
      JSON.stringify(call[0])
    );
    expect(prompts.some((prompt) => prompt.includes('started a list'))).toBe(
      false
    );
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      'Here are the options:'
    );
    expect(useLLMStore.getState().isGenerating).toBe(false);
  });

  it('keeps the draft when the user stops during the retry', async () => {
    mockInstance.generate
      .mockResolvedValueOnce('Sorry, I do not have the sources.')
      .mockImplementationOnce(async () => {
        useLLMStore.getState().interrupt();
        return 'The sources say';
      })
      .mockResolvedValue('');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage(
        'Sorry, I do not have the sources.',
        1,
        noSources,
        settings
      );

    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).not.toBe(
      'The sources say'
    );
  });

  it('keeps the answer when only the think block loops', async () => {
    const reasoning = 'I should check every source again carefully. '.repeat(4);
    mockInstance.generate.mockResolvedValue(
      `<think>${reasoning}</think>Bilet kosztuje 150 zł.`
    );
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('ile kosztuje bilet?', 1, noSources, settings);

    expect(useLLMStore.getState().generationError).toBeNull();
    const content = useLLMStore.getState().activeChatMessages.at(-1)?.content;
    expect(content).toContain('Bilet kosztuje 150 zł.');
    expect(content).toContain('</think>');
  });

  it('keeps an answer the model left inside a think block it never closed', async () => {
    mockInstance.generate.mockResolvedValue(
      '<think>Weighing the sources. The president of Ukraine is Volodymyr Zelensky.'
    );
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('who is president of Ukraine?', 1, noSources, settings);

    expect(useLLMStore.getState().generationError).toBeNull();
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toContain(
      'Volodymyr Zelensky'
    );
  });

  it('leaves an older answer alone when the turn it belongs to is gone', async () => {
    const earlierAnswer: Message = {
      id: 9,
      chatId: 1,
      role: 'assistant',
      content: 'Warszawa.',
      timestamp: 0,
    };
    mockInstance.generate.mockImplementation(async () => {
      capturedTokenCallback?.('Krakow.');
      await flushFrame();
      useLLMStore.setState({
        activeChatMessages: [
          { id: 8, chatId: 1, role: 'user', content: 'stolica?', timestamp: 0 },
          earlierAnswer,
        ],
      });
      return 'Krakow.';
    });
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('a dawna stolica?', 1, noSources, settings);

    expect(
      useLLMStore.getState().activeChatMessages.map((m) => m.content)
    ).toEqual(['stolica?', 'Warszawa.']);
  });

  it('streams into the message of its own turn, not the one before it', async () => {
    const onToken = await loadModel();
    useLLMStore.setState({
      isProcessingPrompt: false,
      isGenerating: true,
      activeChatId: 1,
      generatingForChatId: 1,
      generatingMessageLocalId: 42,
      activeChatMessages: [
        { id: 8, chatId: 1, role: 'user', content: 'stolica?', timestamp: 0 },
        {
          id: 9,
          chatId: 1,
          role: 'assistant',
          content: 'Warszawa.',
          timestamp: 0,
        },
      ] as Message[],
    });

    onToken(' Krakow.');
    await flushFrame();

    expect(
      useLLMStore.getState().activeChatMessages.map((m) => m.content)
    ).toEqual(['stolica?', 'Warszawa.']);
  });

  it('still fails the turn when the model returns nothing at all', async () => {
    mockInstance.generate.mockResolvedValue('   ');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('co zabrać do samolotu?', 1, noSources, settings);

    expect(useLLMStore.getState().generationError).toEqual({
      chatId: 1,
      message: 'Failed to generate a response.',
    });
  });

  it('recovers via the continuation nudge when the loop guard trims a list short', async () => {
    mockInstance.generate
      .mockResolvedValueOnce(
        'Oto rzeczy do zabrania:\n' +
          '1. Paszport do podróży zagranicznej.\n' +
          '2. Paszport do podróży zagranicznej.\n' +
          '3. Paszport do podróży zagranicznej.'
      )
      .mockResolvedValueOnce(
        '1. Paszport do podróży zagranicznej.\n' +
          '2. Bilet lotniczy w formie elektronicznej.\n' +
          '3. Ładowarka do telefonu komórkowego.'
      )
      .mockResolvedValue('');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('co zabrać do samolotu?', 1, noSources, settings);

    expect(mockInstance.generate).toHaveBeenCalledTimes(3);
    expect(useLLMStore.getState().generationError).toBeNull();
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      'Oto rzeczy do zabrania:\n' +
        '1. Paszport do podróży zagranicznej.\n' +
        '2. Bilet lotniczy w formie elektronicznej.\n' +
        '3. Ładowarka do telefonu komórkowego.'
    );
  });

  it('does not update performance metrics on last message when user navigated away', async () => {
    mockInstance.generate.mockImplementation(async () => {
      useLLMStore.setState({ activeChatId: 99 });
      return 'response';
    });
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('ping', 1, noSources, settings);

    const messages = useLLMStore.getState().activeChatMessages;
    const lastMsg = messages[messages.length - 1];
    expect(lastMsg?.timeToFirstToken).toBeUndefined();
  });
});

describe('sendChatMessage — settings hydration barrier', () => {
  const settings = { systemPrompt: 'be helpful' };

  beforeEach(async () => {
    await loadModel();
    mockPersistMessage.mockResolvedValue(42);
    mockInstance.generate.mockResolvedValue('response');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });
  });

  it('does not read customSystemPrompt until settings have hydrated (cold-start race)', async () => {
    useSettingsStore.setState({ hasHydrated: false, customSystemPrompt: '' });

    const sendPromise = useLLMStore
      .getState()
      .sendChatMessage('ping', 1, async () => ({ context: [] }), settings);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(prepareMessagesForLLM).not.toHaveBeenCalled();
    expect(mockInstance.generate).not.toHaveBeenCalled();

    useSettingsStore.setState({
      hasHydrated: true,
      customSystemPrompt: 'Always end replies with BANANA',
    });

    await sendPromise;

    expect(prepareMessagesForLLM).toHaveBeenCalledTimes(1);
    expect(
      (prepareMessagesForLLM as jest.Mock).mock.calls[0][4].customSystemPrompt
    ).toBe('Always end replies with BANANA');
  });

  it('reads customSystemPrompt immediately when settings are already hydrated', async () => {
    useSettingsStore.setState({
      hasHydrated: true,
      customSystemPrompt: 'Be concise.',
    });

    await useLLMStore
      .getState()
      .sendChatMessage('hi', 1, async () => ({ context: [] }), settings);

    expect(prepareMessagesForLLM).toHaveBeenCalledTimes(1);
    expect(
      (prepareMessagesForLLM as jest.Mock).mock.calls[0][4].customSystemPrompt
    ).toBe('Be concise.');
  });
});

describe('a turn that was superseded before it settled', () => {
  const settings = { systemPrompt: 'be helpful' };

  const until = async (ready: () => boolean) => {
    for (let tick = 0; tick < 50 && !ready(); tick++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (!ready()) throw new Error('the store never reached the expected state');
  };

  beforeEach(async () => {
    await loadModel();
    mockPersistMessage.mockResolvedValue(42);
  });

  it('leaves the running turn alone when an interrupted one rejects late', async () => {
    let rejectFirst!: (reason: Error) => void;
    let resolveSecond!: (answer: string) => void;
    mockInstance.generate
      .mockReturnValueOnce(
        new Promise<string>((_, reject) => {
          rejectFirst = reject;
        })
      )
      .mockReturnValueOnce(
        new Promise<string>((resolve) => {
          resolveSecond = resolve;
        })
      );

    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    const first = useLLMStore
      .getState()
      .sendChatMessage('question in chat one', 1, noSources, settings);
    await until(() => mockInstance.generate.mock.calls.length === 1);

    useLLMStore.getState().interrupt();

    const second = useLLMStore
      .getState()
      .sendChatMessage('question in chat two', 2, noSources, settings);
    rejectFirst(new Error('interrupted'));
    await until(() => mockInstance.generate.mock.calls.length === 2);
    expect(useLLMStore.getState().generatingForChatId).toBe(2);

    await first;

    expect(useLLMStore.getState().generatingForChatId).toBe(2);
    expect(useLLMStore.getState().isGenerating).toBe(true);
    expect(useLLMStore.getState().generationError).toBeNull();

    resolveSecond('The answer for chat two.');
    await second;
  });
});

describe('sendEventMessage', () => {
  it('appends event message to activeChatMessages', async () => {
    mockPersistMessage.mockResolvedValue(77);
    useLLMStore.setState({ db: mockDb, activeChatMessages: [] });

    await useLLMStore.getState().sendEventMessage(1, 'Source deleted');

    const messages = useLLMStore.getState().activeChatMessages;
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('event');
    expect(messages[0].content).toBe('Source deleted');
    expect(messages[0].id).toBe(77);
  });

  it('does nothing when db is not set', async () => {
    useLLMStore.setState({ db: null });
    await useLLMStore.getState().sendEventMessage(1, 'test');
    expect(mockPersistMessage).not.toHaveBeenCalled();
  });
});

describe('setActiveChatId', () => {
  it('drops the previous chat’s live trace when another chat is opened, so the saved trace is rebuilt from the database (S8.11)', async () => {
    useWebSearchStore.setState({
      isSearchingWeb: false,
      webSearchTrace: [
        { id: 1, type: 'found', url: 'https://a.com/x', host: 'a.com' },
      ],
    });
    mockGetChatMessages.mockResolvedValue([]);
    useLLMStore.setState({ db: mockDb, activeChatId: 4 });

    await useLLMStore.getState().setActiveChatId(5);

    expect(useWebSearchStore.getState().webSearchTrace).toEqual([]);
  });

  it('keeps the trace of a search that is still running when chats are switched', async () => {
    const running = [
      { id: 1, type: 'searching' as const, query: 'kurs bitcoin' },
    ];
    useWebSearchStore.setState({
      isSearchingWeb: true,
      webSearchTrace: running,
    });
    mockGetChatMessages.mockResolvedValue([]);
    useLLMStore.setState({ db: mockDb, activeChatId: 4 });

    await useLLMStore.getState().setActiveChatId(5);

    expect(useWebSearchStore.getState().webSearchTrace).toEqual(running);
    useWebSearchStore.setState({ isSearchingWeb: false, webSearchTrace: [] });
  });

  it('loads messages for the given chat id', async () => {
    const messages = [
      { id: 1, chatId: 5, role: 'user', content: 'hi', timestamp: 0 },
    ];
    mockGetChatMessages.mockResolvedValue(messages);
    useLLMStore.setState({ db: mockDb });

    await useLLMStore.getState().setActiveChatId(5);

    expect(useLLMStore.getState().activeChatId).toBe(5);
    expect(useLLMStore.getState().activeChatMessages).toEqual(messages);
  });

  it('shows everything streamed so far when the user comes back to the chat that is still answering (Pixel: drawer → New chat → back)', async () => {
    const onToken = await loadModel();
    mockPersistMessage.mockResolvedValue(7);
    let finish!: (text: string) => void;
    mockInstance.generate.mockImplementationOnce(
      () => new Promise<string>((resolve) => (finish = resolve))
    );
    useLLMStore.setState({ activeChatId: 1, activeChatMessages: [] });
    const turn = useLLMStore
      .getState()
      .sendChatMessage('Czy jest tam jedzenie vege?', 1, noSources, {
        systemPrompt: '',
      });
    while (mockInstance.generate.mock.calls.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    onToken('Tak, ');
    await flushFrame();

    mockGetChatMessages.mockResolvedValue([]);
    await useLLMStore.getState().setActiveChatId(null);
    onToken('jest opcja wege.');
    await flushFrame();
    mockGetChatMessages.mockResolvedValue([
      {
        id: 7,
        chatId: 1,
        role: 'user',
        content: 'Czy jest tam jedzenie vege?',
        timestamp: 0,
      },
    ]);
    await useLLMStore.getState().setActiveChatId(1);

    expect(useLLMStore.getState().activeChatMessages.at(-1)).toMatchObject({
      role: 'assistant',
      content: 'Tak, jest opcja wege.',
    });
    finish('Tak, jest opcja wege.');
    await turn;
  });

  it('keeps streaming into the answer and finishes it after the user comes back to the chat', async () => {
    const onToken = await loadModel();
    mockPersistMessage.mockResolvedValue(7);
    let finish!: (text: string) => void;
    mockInstance.generate.mockImplementationOnce(
      () => new Promise<string>((resolve) => (finish = resolve))
    );
    useLLMStore.setState({ activeChatId: 1, activeChatMessages: [] });
    const turn = useLLMStore
      .getState()
      .sendChatMessage('Czy jest tam jedzenie vege?', 1, noSources, {
        systemPrompt: '',
      });
    while (mockInstance.generate.mock.calls.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    onToken('Tak, ');
    await flushFrame();

    mockGetChatMessages.mockResolvedValue([]);
    await useLLMStore.getState().setActiveChatId(null);
    mockGetChatMessages.mockResolvedValue([
      {
        id: 6,
        chatId: 1,
        role: 'user',
        content: 'Czy jest tam jedzenie vege?',
        timestamp: 0,
      },
    ]);
    await useLLMStore.getState().setActiveChatId(1);

    onToken('jest opcja wege.');
    await flushFrame();
    expect(useLLMStore.getState().activeChatMessages.at(-1)).toMatchObject({
      role: 'assistant',
      content: 'Tak, jest opcja wege.',
    });

    finish('Tak, jest opcja wege.');
    await turn;

    const answers = useLLMStore
      .getState()
      .activeChatMessages.filter((message) => message.role === 'assistant');
    expect(answers).toHaveLength(1);
    expect(answers[0]).toMatchObject({
      id: 7,
      content: 'Tak, jest opcja wege.',
    });
  });

  it('does not lend one chat’s digest to another chat’s prompt (Pixel: coffee summary in a weather search)', async () => {
    mockGetChatMessages.mockResolvedValue([]);
    (chatRepository.getChatDigest as jest.Mock).mockResolvedValueOnce(
      'Rozmowa o parzeniu kawy w kawiarce.'
    );
    useLLMStore.setState({ db: mockDb });
    await useLLMStore.getState().setActiveChatId(4);
    expect(useLLMStore.getState().activeChatDigest).toBe(
      'Rozmowa o parzeniu kawy w kawiarce.'
    );

    await loadModel();
    mockPersistMessage.mockResolvedValue(7);
    mockInstance.generate.mockResolvedValue('Jutro 28 stopni.');
    useLLMStore.setState({ activeChatId: 9, activeChatMessages: [] });
    await useLLMStore
      .getState()
      .sendChatMessage('a jutro?', 9, noSources, { systemPrompt: '' });

    const promptOptions = (prepareMessagesForLLM as jest.Mock).mock.calls.at(
      -1
    )![4];
    expect(promptOptions.digest).toBeUndefined();
  });

  it('clears messages when called with null', async () => {
    useLLMStore.setState({
      db: mockDb,
      activeChatId: 5,
      activeChatMessages: [
        { id: 1, chatId: 5, role: 'user', content: 'hi', timestamp: 0 },
      ],
    });

    await useLLMStore.getState().setActiveChatId(null);

    expect(useLLMStore.getState().activeChatId).toBeNull();
    expect(useLLMStore.getState().activeChatMessages).toEqual([]);
  });

  it('keeps the optimistic messages of the chat it is generating for', async () => {
    const optimistic = [
      { id: -1, chatId: 5, role: 'user' as const, content: 'hi', timestamp: 0 },
    ];
    mockGetChatMessages.mockResolvedValue([]);
    useLLMStore.setState({
      db: mockDb,
      generatingForChatId: 5,
      activeChatMessages: optimistic,
    });

    await useLLMStore.getState().setActiveChatId(5);

    expect(mockGetChatMessages).not.toHaveBeenCalled();
    expect(useLLMStore.getState().activeChatMessages).toEqual(optimistic);
  });

  it('reloads a generating chat whose messages were cleared, and re-arms a reply row', async () => {
    const persisted = [
      { id: 1, chatId: 5, role: 'user' as const, content: 'hi', timestamp: 0 },
    ];
    mockGetChatMessages.mockResolvedValue(persisted);
    useLLMStore.setState({
      db: mockDb,
      model: baseModel,
      generatingForChatId: 5,
      activeChatMessages: [],
    });

    await useLLMStore.getState().setActiveChatId(5);

    const messages = useLLMStore.getState().activeChatMessages;
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual(persisted[0]);
    expect(messages[1]).toMatchObject({ role: 'assistant', content: '' });
  });
});

describe('refreshActiveChatMessages', () => {
  it('reloads messages for the active chat', async () => {
    const fresh = [
      { id: 9, chatId: 3, role: 'assistant', content: 'updated', timestamp: 0 },
    ];
    mockGetChatMessages.mockResolvedValue(fresh);
    useLLMStore.setState({ db: mockDb, activeChatId: 3 });

    await useLLMStore.getState().refreshActiveChatMessages();

    expect(useLLMStore.getState().activeChatMessages).toEqual(fresh);
  });

  it('does nothing when activeChatId is null', async () => {
    useLLMStore.setState({ db: mockDb, activeChatId: null });
    await useLLMStore.getState().refreshActiveChatMessages();
    expect(mockGetChatMessages).not.toHaveBeenCalled();
  });
});

describe('sendChatMessage imagePath', () => {
  const settings = { systemPrompt: '' };

  beforeEach(async () => {
    await loadModel();
    mockPersistMessage.mockResolvedValue(42);
    mockGetChatMessages.mockResolvedValue([]);
    useLLMStore.setState({
      model: {
        ...baseModel,
        modelName: 'LFM VL',
        vision: true,
        featured: true,
      } as Model,
      activeChatId: 1,
      activeChatMessages: [],
    });
  });

  it('passes imagePath to persistMessage for user message when provided', async () => {
    await useLLMStore
      .getState()
      .sendChatMessage(
        'What is this?',
        1,
        noSources,
        settings,
        '/local/image.jpg'
      );

    expect(mockPersistMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ imagePath: '/local/image.jpg', role: 'user' })
    );
  });

  it('passes undefined imagePath to persistMessage when not provided', async () => {
    await useLLMStore
      .getState()
      .sendChatMessage('Hello', 1, noSources, settings);

    expect(mockPersistMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ role: 'user' })
    );
    const userMessageCall = mockPersistMessage.mock.calls.find(
      (call) => call[1].role === 'user'
    );
    expect(userMessageCall[1].imagePath).toBeUndefined();
  });

  it('passes mediaPath to llmInstance.generate when imagePath is provided', async () => {
    (prepareMessagesForLLM as jest.Mock).mockReturnValueOnce([
      { role: 'user', content: 'What is this?', mediaPath: '/local/image.jpg' },
    ]);

    await useLLMStore
      .getState()
      .sendChatMessage(
        'What is this?',
        1,
        noSources,
        settings,
        '/local/image.jpg'
      );

    expect(mockInstance.generate).toHaveBeenCalledTimes(1);
    const calledMessages = mockInstance.generate.mock.calls[0][0];
    expect(calledMessages[calledMessages.length - 1]).toMatchObject({
      role: 'user',
      mediaPath: '/local/image.jpg',
    });
  });
});

// ─── runBenchmark ─────────────────────────────────────────────────────────────

describe('runBenchmark', () => {
  const streamMeasurableRun = (tokenCallback: (token: string) => void) => {
    let now = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => (now += 50));
    mockInstance.getGeneratedTokenCount.mockReturnValue(50);
    mockInstance.generate.mockImplementation(async () => {
      await flushFrame();
      tokenCallback('tok');
      await flushFrame();
      return 'output text';
    });
  };

  it('returns undefined and resets flags when no llmInstance is loaded', async () => {
    // Don't call loadModel — llmInstance is null from module reset
    useLLMStore.setState({ model: null });

    const result = await useLLMStore.getState().runBenchmark();

    expect(result).toBeUndefined();
    expect(useLLMStore.getState().isGenerating).toBe(false);
    expect(useLLMStore.getState().isBenchmarking).toBe(false);
  });

  it('sets isGenerating and isBenchmarking flags while running', async () => {
    await loadModel();
    let wasGenerating = false;
    let wasBenchmarking = false;

    mockInstance.generate.mockImplementation(async () => {
      wasGenerating = useLLMStore.getState().isGenerating;
      wasBenchmarking = useLLMStore.getState().isBenchmarking;
      return 'benchmark result';
    });
    useLLMStore.setState({ model: baseModel });

    await useLLMStore.getState().runBenchmark();

    expect(wasGenerating).toBe(true);
    expect(wasBenchmarking).toBe(true);
    expect(useLLMStore.getState().isGenerating).toBe(false);
    expect(useLLMStore.getState().isBenchmarking).toBe(false);
  });

  it('returns performance metrics on success', async () => {
    const tokenCallback = await loadModel();
    let now = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => (now += 50));
    mockInstance.generate.mockImplementation(async () => {
      await flushFrame();
      tokenCallback('tok');
      await flushFrame();
      return 'output text';
    });
    mockInstance.getGeneratedTokenCount.mockReturnValue(50);
    useLLMStore.setState({ model: baseModel });

    const result = await useLLMStore.getState().runBenchmark();

    expect(result).toMatchObject({
      totalTime: expect.any(Number),
      timeToFirstToken: expect.any(Number),
      tokensPerSecond: expect.any(Number),
      tokensGenerated: 50,
      peakMemory: expect.any(Number),
    });
  });

  it('resets flags even when generate throws', async () => {
    await loadModel();
    mockInstance.generate.mockRejectedValue(new Error('OOM'));
    useLLMStore.setState({ model: baseModel });

    await useLLMStore.getState().runBenchmark();

    expect(useLLMStore.getState().isGenerating).toBe(false);
    expect(useLLMStore.getState().isBenchmarking).toBe(false);
  });

  it('reports the highest footprint the run reached', async () => {
    streamMeasurableRun(await loadModel());
    useLLMStore.setState({ model: baseModel });
    memoryProbe.available = true;
    memoryProbe.samples = [1_000_000_000, 5_000_000_000];

    const result = await useLLMStore.getState().runBenchmark();

    expect(result?.peakMemory).toBe(5_000_000_000);
  });

  it('takes its first sample without waiting for the sampling interval', async () => {
    streamMeasurableRun(await loadModel());
    useLLMStore.setState({ model: baseModel });
    memoryProbe.available = true;
    memoryProbe.samples = [1_234_000_000];

    const result = await useLLMStore.getState().runBenchmark();

    expect(result?.peakMemory).toBe(1_234_000_000);
  });

  it('reports nothing when the device has no footprint probe', async () => {
    streamMeasurableRun(await loadModel());
    useLLMStore.setState({ model: baseModel });
    memoryProbe.available = false;
    memoryProbe.samples = [9_000_000_000];

    const result = await useLLMStore.getState().runBenchmark();

    expect(result?.peakMemory).toBe(0);
  });

  it('stops every run at the same token budget so runs can be compared', async () => {
    await loadModel();
    useLLMStore.setState({ model: baseModel });

    let emitted = 0;
    let interruptedAt = 0;
    mockInstance.interrupt.mockImplementation(() => {
      if (interruptedAt === 0) interruptedAt = emitted;
    });
    mockInstance.getGeneratedTokenCount.mockImplementation(() => emitted);
    mockInstance.generate.mockImplementation(async () => {
      for (let i = 0; i < 40; i++) {
        emitted += 4;
        capturedTokenCallback!('four tokens worth');
      }
      return 'out';
    });

    await useLLMStore.getState().runBenchmark();

    expect(interruptedAt).toBe(128);
  });

  it('pins sampling for the run and hands the model back its own config', async () => {
    await loadModel();
    useLLMStore.setState({ model: baseModel });
    mockInstance.generate.mockResolvedValue('out');
    mockInstance.configure.mockClear();

    await useLLMStore.getState().runBenchmark();

    const [pinned] = mockInstance.configure.mock.calls[0]!;
    expect(pinned.generationConfig).toMatchObject({ temperature: 0.01 });
    const [restored] = mockInstance.configure.mock.calls.at(-1)!;
    expect(restored.generationConfig).not.toMatchObject({ temperature: 0.01 });
  });

  it('does not carry the token budget into an ordinary chat turn', async () => {
    await loadModel();
    useLLMStore.setState({ model: baseModel });
    mockInstance.generate.mockResolvedValue('out');
    await useLLMStore.getState().runBenchmark();

    mockInstance.interrupt.mockClear();
    mockInstance.getGeneratedTokenCount.mockReturnValue(9999);
    useLLMStore.setState({ isGenerating: true, isProcessingPrompt: false });
    for (let i = 0; i < 148; i++) capturedTokenCallback!('tok');

    expect(mockInstance.interrupt).not.toHaveBeenCalled();
  });

  it('tracks a fresh first token on every run without stale carry-over', async () => {
    await loadModel();
    useLLMStore.setState({ model: baseModel });

    // The RN jest preset aliases performance.now to Date.now (1 ms resolution),
    // so on a fast machine startTime and the first token can share a millisecond
    // and the measured delta collapses to 0. Advance a virtual clock instead.
    let now = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => (now += 50));

    mockInstance.generate.mockImplementation(async () => {
      await flushFrame();
      capturedTokenCallback!('tok');
      await flushFrame();
      return 'out';
    });

    const first = await useLLMStore.getState().runBenchmark();
    const second = await useLLMStore.getState().runBenchmark();

    expect(first?.timeToFirstToken).toBeGreaterThan(0);
    expect(second?.timeToFirstToken).toBeGreaterThan(0);
  });
});

describe('a model picked just before sending must be the one that answers', () => {
  const settings = { systemPrompt: 'be helpful' };
  const otherModel = { ...baseModel, id: 2, modelName: 'Second LLM' };

  beforeEach(async () => {
    await loadModel();
    mockPersistMessage.mockResolvedValue(42);
    mockInstance.generate.mockResolvedValue('The answer is 42.');
    useLLMStore.setState({ activeChatId: 1, activeChatMessages: [] });
  });

  it('stamps the reply with the newly selected model, not the previous one', async () => {
    useLLMStore.getState().loadModel(otherModel);

    await useLLMStore
      .getState()
      .sendChatMessage('ping', 1, noSources, settings);

    const assistantWrites = mockPersistMessage.mock.calls.filter(
      (call) => call[1]?.role === 'assistant'
    );
    expect(assistantWrites.length).toBeGreaterThan(0);
    expect(assistantWrites.at(-1)![1].modelName).toBe('Second LLM');
  });

  it('leaves the store on the newly selected model after the turn', async () => {
    useLLMStore.getState().loadModel(otherModel);

    await useLLMStore
      .getState()
      .sendChatMessage('ping', 1, noSources, settings);

    expect(useLLMStore.getState().model?.modelName).toBe('Second LLM');
  });
});

describe('one turn at a time (S20 FE: sends lost or doubled while a turn was still open)', () => {
  const settings = { systemPrompt: 'be helpful' };
  const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(async () => {
    await loadModel();
    mockPersistMessage.mockResolvedValue(42);
    mockInstance.generate.mockResolvedValue('The answer is 42.');
    useLLMStore.setState({ activeChatId: 1, activeChatMessages: [] });
  });

  it('refuses a second send while the first turn is still answering', async () => {
    let finish!: (text: string) => void;
    mockInstance.generate.mockImplementationOnce(
      () => new Promise<string>((resolve) => (finish = resolve))
    );

    const first = useLLMStore
      .getState()
      .sendChatMessage('first', 1, noSources, settings);
    while (mockInstance.generate.mock.calls.length === 0) await nextTick();

    const second = await useLLMStore
      .getState()
      .sendChatMessage('second', 1, noSources, settings);
    finish('done');

    expect(second).toBe(false);
    expect(await first).toBe(true);
    expect(
      useLLMStore.getState().activeChatMessages.map((m) => m.content)
    ).toEqual(['first', 'done']);
  });

  it('shows the message and the stop state while a model switch is still loading', async () => {
    let releaseLoad!: () => void;
    mockLLMModule.fromModelName.mockImplementationOnce(
      async (_sources, _progress, onToken) => {
        capturedTokenCallback = onToken;
        await new Promise<void>((resolve) => (releaseLoad = resolve));
        return mockInstance as unknown as LLMModule;
      }
    );
    const otherModel = { ...baseModel, id: 2, modelName: 'Second LLM' };
    useLLMStore.getState().loadModel(otherModel);
    await nextTick();

    const turn = useLLMStore
      .getState()
      .sendChatMessage('ping', 1, noSources, settings);
    await nextTick();

    expect(
      useLLMStore.getState().activeChatMessages.map((m) => m.role)
    ).toEqual(['user', 'assistant']);
    expect(useLLMStore.getState().isProcessingPrompt).toBe(true);

    releaseLoad();
    expect(await turn).toBe(true);
    const assistantWrites = mockPersistMessage.mock.calls.filter(
      (call) => call[1]?.role === 'assistant'
    );
    expect(assistantWrites.at(-1)![1].modelName).toBe('Second LLM');
  });

  it('loads an already downloaded model without asking the network', async () => {
    const NetInfo = require('@react-native-community/netinfo').default;
    NetInfo.fetch.mockClear();
    const loads = mockLLMModule.fromModelName.mock.calls.length;

    await useLLMStore.getState().loadModel({ ...baseModel, id: 3 });

    expect(NetInfo.fetch).not.toHaveBeenCalled();
    expect(mockLLMModule.fromModelName.mock.calls.length).toBe(loads + 1);
  });

  it('still refuses a model that is not on the device while offline', async () => {
    const NetInfo = require('@react-native-community/netinfo').default;
    NetInfo.fetch.mockResolvedValueOnce({ isConnected: false });
    const loads = mockLLMModule.fromModelName.mock.calls.length;

    await useLLMStore
      .getState()
      .loadModel({ ...baseModel, id: 3, isDownloaded: false });

    expect(mockLLMModule.fromModelName.mock.calls.length).toBe(loads);
  });

  it('keeps the model loaded when the answer came back empty', async () => {
    mockInstance.generate.mockResolvedValue('');

    await useLLMStore
      .getState()
      .sendChatMessage('ping', 1, noSources, settings);

    expect(mockInstance.delete).not.toHaveBeenCalled();
    expect(useLLMStore.getState().generationError?.message).toBe(
      'Failed to generate a response.'
    );
  });

  it('does not call a stop the user asked for a failure, even with nothing outside the think block', async () => {
    const thinkingOnly = '<think>weighing the options';
    mockInstance.generate.mockImplementationOnce(async () => {
      capturedTokenCallback!(thinkingOnly);
      await flushFrame();
      useLLMStore.setState({ isGenerating: false, isProcessingPrompt: false });
      return thinkingOnly;
    });

    await useLLMStore
      .getState()
      .sendChatMessage('write a long essay', 1, noSources, settings);

    expect(useLLMStore.getState().generationError).toBeNull();
  });

  it('drops the bubble when the model only looped inside an unterminated think block (iPhone SE)', async () => {
    const looped = '<think>cząstek cząstek cząstek cząstek cząstek';
    mockInstance.generate.mockImplementationOnce(async () => {
      capturedTokenCallback!(looped);
      await flushFrame();
      return looped;
    });

    await useLLMStore
      .getState()
      .sendChatMessage('Wyjaśnij fotosyntezę.', 1, noSources, settings);

    expect(
      useLLMStore.getState().activeChatMessages.map((m) => m.role)
    ).toEqual(['user']);
    expect(useLLMStore.getState().generationError?.message).toBe(
      'Failed to generate a response.'
    );
    expect(mockInstance.delete).not.toHaveBeenCalled();
  });

  it('does not let a stump left by Stop become the conversation topic', async () => {
    const setDigest = chatRepository.setChatDigest as jest.Mock;
    setDigest.mockClear();
    mockInstance.generate.mockImplementationOnce(async () => {
      useLLMStore.getState().interrupt();
      return 'Cześć.';
    });

    await useLLMStore
      .getState()
      .sendChatMessage(
        'Wybieram się na weekend do Zakopanego, zaplanuj wyjazd.',
        1,
        noSources,
        settings
      );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(setDigest).not.toHaveBeenCalled();
  });

  it('summarizes a turn that finished on its own', async () => {
    const setDigest = chatRepository.setChatDigest as jest.Mock;
    setDigest.mockClear();

    await useLLMStore
      .getState()
      .sendChatMessage('ping', 1, noSources, settings);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(setDigest).toHaveBeenCalled();
  });

  it('skips the refining pass when the first answer already used up the time budget', async () => {
    let now = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => now);
    const wrongLanguage =
      "Kazimierz Wielki (1310–1370) Polska'nın en son piastıydı. İşte maddeler:";
    mockInstance.generate.mockImplementationOnce(async () => {
      now = 50_000;
      return wrongLanguage;
    });

    await useLLMStore
      .getState()
      .sendChatMessage(
        'Kim był Kazimierz Wielki i czego dokonał?',
        1,
        noSources,
        settings
      );

    const nudges = mockInstance.generate.mock.calls.filter((call) =>
      (call[0] as { content: string }[]).some(
        (message) =>
          typeof message.content === 'string' &&
          message.content.includes('written in the wrong language')
      )
    );
    expect(nudges).toHaveLength(0);
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      wrongLanguage
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('over its time budget')
    );
  });
});

describe('one generation at a time on the shared native runner', () => {
  const settings = { systemPrompt: 'be helpful' };

  const within50Ticks = async (ready: () => boolean) => {
    for (let tick = 0; tick < 50 && !ready(); tick++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return ready();
  };

  beforeEach(async () => {
    await loadModel();
    mockPersistMessage.mockResolvedValue(42);
    useLLMStore.setState({ activeChatId: 1, activeChatMessages: [] });
  });

  it('holds a chat turn back until a utility call has released the model', async () => {
    let releasePlanner!: (answer: string) => void;
    mockInstance.generate.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        releasePlanner = resolve;
      })
    );

    const planning = useLLMStore
      .getState()
      .generateUtility([{ role: 'user', content: 'plan' }]);
    expect(
      await within50Ticks(() => mockInstance.generate.mock.calls.length === 1)
    ).toBe(true);

    mockInstance.generate.mockResolvedValue('The answer.');
    const turn = useLLMStore
      .getState()
      .sendChatMessage('question', 1, noSources, settings);

    expect(
      await within50Ticks(() => mockInstance.generate.mock.calls.length > 1)
    ).toBe(false);

    releasePlanner('');
    await planning;
    await turn;
    expect(mockInstance.generate.mock.calls.length).toBeGreaterThan(1);
  });

  it('does not delete a model that is still generating', async () => {
    let finish!: (answer: string) => void;
    mockInstance.generate.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        finish = resolve;
      })
    );

    const turn = useLLMStore
      .getState()
      .sendChatMessage('question', 1, noSources, settings);
    expect(
      await within50Ticks(() => mockInstance.generate.mock.calls.length === 1)
    ).toBe(true);

    const switching = useLLMStore
      .getState()
      .loadModel({ ...baseModel, id: 2, modelName: 'Other LLM' });

    expect(
      await within50Ticks(() => mockInstance.delete.mock.calls.length > 0)
    ).toBe(false);
    expect(mockInstance.interrupt).toHaveBeenCalled();

    finish('The answer.');
    await turn;
    await switching;
    expect(mockInstance.delete).toHaveBeenCalled();
  });
});

// ─── the busy-model wait has a limit ──────────────────────────────────────────

describe('sendChatMessage when the model never goes idle', () => {
  const settings = { systemPrompt: 'be helpful' };

  it('gives up instead of waiting forever', async () => {
    await loadModel();
    mockPersistMessage.mockResolvedValue(42);
    mockGetChatMessages.mockResolvedValue([]);
    useLLMStore.setState({ model: baseModel, activeChatId: 1 });
    mockInstance.generate.mockResolvedValue('should never be reached');

    const startedAt = Date.now();
    let elapsed = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => {
      elapsed += 5000;
      return startedAt + elapsed;
    });

    useLLMStore.setState({ isLoading: true });

    await useLLMStore.getState().sendChatMessage('hi', 1, noSources, settings);

    expect(mockInstance.generate).not.toHaveBeenCalled();
    expect(useLLMStore.getState().generationError).not.toBeNull();
  }, 15000);
});

// ─── interrupted turns ────────────────────────────────────────────────────────

describe('a turn abandoned before its first token', () => {
  const settings = { systemPrompt: 'be helpful' };

  beforeEach(async () => {
    await loadModel();
    mockPersistMessage.mockResolvedValue(42);
    mockGetChatMessages.mockResolvedValue([]);
    useLLMStore.setState({ model: baseModel, activeChatId: 1 });
  });

  const runAbandonedTurn = async (tokensAfterAbandon: number) => {
    mockInstance.interrupt.mockClear();
    mockInstance.generate.mockImplementation(async () => {
      await flushFrame();
      useLLMStore.getState().interrupt();
      await flushFrame();
      for (let i = 0; i < tokensAfterAbandon; i++) {
        capturedTokenCallback!('tok');
        await flushFrame();
      }
      return 'Sure, here we go';
    });
    mockInstance.getGeneratedTokenCount.mockReturnValue(2);

    await useLLMStore.getState().sendChatMessage('hi', 1, noSources, settings);

    return mockInstance.interrupt.mock.calls.length;
  };

  it('does not ask the runtime to stop again for every token it keeps delivering', async () => {
    const withFewTokens = await runAbandonedTurn(6);
    const withManyTokens = await runAbandonedTurn(40);

    expect(withManyTokens).toBe(withFewTokens);
  });

  it('keeps streaming when the abandon happens after the first token landed', async () => {
    mockInstance.generate.mockImplementation(async () => {
      await flushFrame();
      capturedTokenCallback!('Sure');
      await flushFrame();
      useLLMStore.getState().interrupt();
      await flushFrame();
      for (let i = 0; i < 10; i++) {
        capturedTokenCallback!('tok');
        await flushFrame();
      }
      return 'Sure, here we go';
    });
    mockInstance.getGeneratedTokenCount.mockReturnValue(11);

    await useLLMStore.getState().sendChatMessage('hi', 1, noSources, settings);

    expect(useLLMStore.getState().performance.tokenCount).toBe(11);
  });
});

describe('runBenchmark when a turn is cut short', () => {
  it('reports no result rather than a zero that would drag an average down', async () => {
    const tokenCallback = await loadModel();
    useLLMStore.setState({ model: baseModel });

    mockInstance.generate.mockImplementation(async () => {
      await flushFrame();
      useLLMStore.getState().interrupt();
      await flushFrame();
      tokenCallback('tok');
      await flushFrame();
      return 'cut short';
    });
    mockInstance.getGeneratedTokenCount.mockReturnValue(2);

    const result = await useLLMStore.getState().runBenchmark();

    expect(result).toBeUndefined();
  });
});

describe('a turn cut short while the app is in the background', () => {
  const settings = { systemPrompt: 'be helpful' };

  const until = async (ready: () => boolean) => {
    for (let tick = 0; tick < 50 && !ready(); tick++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (!ready()) throw new Error('the store never reached the expected state');
  };

  const assistantAnswers = () =>
    useLLMStore
      .getState()
      .activeChatMessages.filter((message) => message.role === 'assistant')
      .map((message) => message.content);

  const generateFailingAfter = (partial: string) => {
    let fail!: (reason: Error) => void;
    mockInstance.generate.mockImplementationOnce(async () => {
      capturedTokenCallback!(partial);
      await flushFrame();
      await new Promise<never>((_, reject) => {
        fail = reject;
      });
    });
    return () => fail(new Error('GPU work refused in the background'));
  };

  beforeEach(async () => {
    useLLMStore.getState().appReturnedToForeground();
    await loadModel();
    mockPersistMessage.mockResolvedValue(42);
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });
  });

  it('holds the turn instead of reporting a failure nobody is there to read', async () => {
    const failGeneration = generateFailingAfter('Machine learning is');

    const turn = useLLMStore
      .getState()
      .sendChatMessage('explain ML', 1, noSources, settings);
    await until(() => assistantAnswers()[0] === 'Machine learning is');
    useLLMStore.getState().appLeftForeground();
    failGeneration();
    await turn;

    expect(useLLMStore.getState().generationError).toBeNull();
    expect(useLLMStore.getState().isGenerating).toBe(false);
    expect(useLLMStore.getState().retryArmedForChatId).toBe(1);
  });

  it('answers the question again when the app comes back, in place of the cut answer', async () => {
    const failGeneration = generateFailingAfter('Machine learning is');
    mockInstance.generate
      .mockResolvedValueOnce(WARMUP_REPLY)
      .mockResolvedValueOnce('Machine learning is a field.');

    const turn = useLLMStore
      .getState()
      .sendChatMessage('explain ML', 1, noSources, settings);
    await until(() => assistantAnswers()[0] === 'Machine learning is');
    useLLMStore.getState().appLeftForeground();
    failGeneration();
    await turn;

    useLLMStore.getState().appReturnedToForeground();
    await until(() => assistantAnswers()[0] === 'Machine learning is a field.');

    expect(assistantAnswers()).toEqual(['Machine learning is a field.']);
    expect(useLLMStore.getState().generationError).toBeNull();
    expect(
      mockPersistMessage.mock.calls.filter(
        ([, message]) => message.role === 'user'
      )
    ).toHaveLength(1);
  });

  it('resumes at once when the failure only surfaces after the app is back', async () => {
    const failGeneration = generateFailingAfter('Machine learning is');
    mockInstance.generate
      .mockResolvedValueOnce(WARMUP_REPLY)
      .mockResolvedValueOnce('Machine learning is a field.');

    const turn = useLLMStore
      .getState()
      .sendChatMessage('explain ML', 1, noSources, settings);
    await until(() => assistantAnswers()[0] === 'Machine learning is');
    useLLMStore.getState().appLeftForeground();
    useLLMStore.getState().appReturnedToForeground();
    failGeneration();
    await turn;

    await until(() => assistantAnswers()[0] === 'Machine learning is a field.');
    expect(useLLMStore.getState().generationError).toBeNull();
  });

  it('says so when the resumed turn fails with the app in front', async () => {
    const failGeneration = generateFailingAfter('Machine learning is');
    mockInstance.generate.mockRejectedValue(new Error('out of memory'));

    const turn = useLLMStore
      .getState()
      .sendChatMessage('explain ML', 1, noSources, settings);
    await until(() => assistantAnswers()[0] === 'Machine learning is');
    useLLMStore.getState().appLeftForeground();
    failGeneration();
    await turn;

    useLLMStore.getState().appReturnedToForeground();
    await until(() => useLLMStore.getState().generationError !== null);

    expect(useLLMStore.getState().generationError).toEqual({
      chatId: 1,
      message: 'Failed to generate a response.',
    });
  });

  it('leaves a turn that finished in the background alone', async () => {
    mockInstance.generate.mockResolvedValueOnce('Machine learning is a field.');

    await useLLMStore
      .getState()
      .sendChatMessage('explain ML', 1, noSources, settings);
    await flushFrame();
    const callsBeforeLeaving = mockInstance.generate.mock.calls.length;
    useLLMStore.getState().appLeftForeground();
    useLLMStore.getState().appReturnedToForeground();
    await flushFrame();

    expect(mockInstance.generate).toHaveBeenCalledTimes(callsBeforeLeaving);
    expect(assistantAnswers()).toEqual(['Machine learning is a field.']);
  });

  it('does not resume into a chat the user has left', async () => {
    const failGeneration = generateFailingAfter('Machine learning is');

    const turn = useLLMStore
      .getState()
      .sendChatMessage('explain ML', 1, noSources, settings);
    await until(() => assistantAnswers()[0] === 'Machine learning is');
    useLLMStore.getState().appLeftForeground();
    failGeneration();
    await turn;
    useLLMStore.setState({ activeChatId: 2, activeChatMessages: [] });

    useLLMStore.getState().appReturnedToForeground();
    await flushFrame();

    expect(mockInstance.generate).toHaveBeenCalledTimes(1);
  });
});

describe('retrying a turn that failed part-way through its answer', () => {
  const settings = { systemPrompt: 'be helpful' };

  it('replaces the cut answer instead of writing a second one under it', async () => {
    await loadModel();
    mockPersistMessage.mockResolvedValue(42);
    mockInstance.generate
      .mockImplementationOnce(async () => {
        capturedTokenCallback!('Machine learning is');
        await flushFrame();
        throw new Error('out of memory');
      })
      .mockResolvedValueOnce('Machine learning is a field.');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('explain ML', 1, noSources, settings);
    await useLLMStore.getState().retryLastGeneration();

    expect(
      useLLMStore
        .getState()
        .activeChatMessages.filter((message) => message.role === 'assistant')
        .map((message) => message.content)
    ).toEqual(['Machine learning is a field.']);
  });
});

describe('the model in the background', () => {
  const settings = { systemPrompt: 'be helpful' };

  beforeEach(async () => {
    useLLMStore.getState().appReturnedToForeground();
    await loadModel();
    mockInstance.delete.mockClear();
    mockLLMModule.fromModelName.mockClear();
    mockPersistMessage.mockResolvedValue(42);
    useLLMStore.setState({ activeChatId: 1, activeChatMessages: [] });
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
  });

  afterEach(() => {
    useLLMStore.getState().appReturnedToForeground();
    jest.useRealTimers();
  });

  it('is released a few seconds after the app goes to the background', async () => {
    useLLMStore.getState().appWentToBackground();
    await jest.advanceTimersByTimeAsync(BACKGROUND_RELEASE_DELAY_MS);

    expect(mockInstance.delete).toHaveBeenCalledTimes(1);
    expect(useLLMStore.getState().model).toEqual(baseModel);
  });

  it('stays loaded through a short trip away', async () => {
    useLLMStore.getState().appWentToBackground();
    await jest.advanceTimersByTimeAsync(BACKGROUND_RELEASE_DELAY_MS / 2);
    useLLMStore.getState().appReturnedToForeground();
    await jest.advanceTimersByTimeAsync(BACKGROUND_RELEASE_DELAY_MS * 4);

    expect(mockInstance.delete).not.toHaveBeenCalled();
  });

  it('stays loaded while the app is only inactive', async () => {
    useLLMStore.getState().appLeftForeground();
    await jest.advanceTimersByTimeAsync(BACKGROUND_RELEASE_DELAY_MS * 4);

    expect(mockInstance.delete).not.toHaveBeenCalled();
  });

  it('lets an answer finish before it is released', async () => {
    let finish!: (answer: string) => void;
    mockInstance.generate.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        finish = resolve;
      })
    );
    const turn = useLLMStore
      .getState()
      .sendChatMessage('question', 1, noSources, settings);
    await jest.advanceTimersByTimeAsync(0);

    useLLMStore.getState().appWentToBackground();
    await jest.advanceTimersByTimeAsync(BACKGROUND_RELEASE_DELAY_MS * 3);
    expect(mockInstance.delete).not.toHaveBeenCalled();

    finish('The answer.');
    await jest.advanceTimersByTimeAsync(BACKGROUND_RELEASE_DELAY_MS * 3);
    await turn;
    await jest.advanceTimersByTimeAsync(BACKGROUND_RELEASE_DELAY_MS);

    expect(mockInstance.delete).toHaveBeenCalled();
  });

  it('is loaded again for the next message once the app is back', async () => {
    useLLMStore.getState().appWentToBackground();
    await jest.advanceTimersByTimeAsync(BACKGROUND_RELEASE_DELAY_MS);
    useLLMStore.getState().appReturnedToForeground();
    mockInstance.generate
      .mockResolvedValueOnce(WARMUP_REPLY)
      .mockResolvedValueOnce('Back again.');

    const turn = useLLMStore
      .getState()
      .sendChatMessage('next question', 1, noSources, settings);
    await jest.advanceTimersByTimeAsync(1000);
    await turn;

    expect(mockLLMModule.fromModelName).toHaveBeenCalledTimes(1);
    expect(mockInstance.generate).toHaveBeenCalled();
  });

  it('is warmed up again when it is loaded back for the next message', async () => {
    useLLMStore.getState().appWentToBackground();
    await jest.advanceTimersByTimeAsync(BACKGROUND_RELEASE_DELAY_MS);
    useLLMStore.getState().appReturnedToForeground();
    mockInstance.generate.mockClear();
    mockInstance.generate
      .mockResolvedValueOnce(WARMUP_REPLY)
      .mockResolvedValueOnce('Back again.');

    const turn = useLLMStore
      .getState()
      .sendChatMessage('next question', 1, noSources, settings);
    await jest.advanceTimersByTimeAsync(1000);
    await turn;

    expect(mockInstance.generate.mock.calls[0][0]).toContainEqual({
      role: 'user',
      content: 'hi',
    });
    expect(mockInstance.generate.mock.calls[1][0]).toContainEqual({
      role: 'user',
      content: 'hello',
    });
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      'Back again.'
    );
  });

  it('is not warmed up while it is loaded with the app in the background', async () => {
    useLLMStore.getState().appWentToBackground();
    mockInstance.generate.mockClear();

    await useLLMStore.getState().loadModel(baseModel, true);

    expect(mockLLMModule.fromModelName).toHaveBeenCalledTimes(1);
    expect(mockInstance.generate).not.toHaveBeenCalled();
  });
});

describe('warming the model up right after it loads', () => {
  const settings = { systemPrompt: 'be helpful' };
  const warmupPrompt = { role: 'user', content: 'hi' };

  const until = async (ready: () => boolean) => {
    for (let tick = 0; tick < 50 && !ready(); tick++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return ready();
  };

  const warmupThatWaits = (instance = mockInstance) => {
    let finish!: (reply: string) => void;
    instance.generate.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        })
    );
    return (reply: string) => finish(reply);
  };

  beforeEach(() => {
    mockPersistMessage.mockResolvedValue(42);
  });

  it('runs one generation on a tiny prompt and stops it at the first token', async () => {
    mockInstance.generate.mockImplementationOnce(async () => {
      capturedTokenCallback!('Hel');
      capturedTokenCallback!('lo');
      return 'Hello';
    });

    await useLLMStore.getState().loadModel(baseModel);

    expect(mockInstance.generate).toHaveBeenCalledTimes(1);
    expect(mockInstance.generate.mock.calls[0][0]).toContainEqual(warmupPrompt);
    expect(mockInstance.interrupt).toHaveBeenCalledTimes(1);
    expect(useLLMStore.getState().isLoading).toBe(false);
    expect(useLLMStore.getState().model).toEqual(baseModel);
  });

  it('keeps its tokens out of the chat, the metrics and the turn flags', async () => {
    const placeholder: Message = {
      id: -1,
      localId: 7,
      chatId: 1,
      role: 'assistant',
      content: '',
      timestamp: 0,
    };
    useLLMStore.setState({
      isProcessingPrompt: true,
      activeChatId: 1,
      generatingForChatId: 1,
      generatingMessageLocalId: 7,
      activeChatMessages: [placeholder],
    });
    mockInstance.generate.mockImplementationOnce(async () => {
      capturedTokenCallback!('Hel');
      capturedTokenCallback!('lo');
      await flushFrame();
      return 'Hello';
    });

    await useLLMStore.getState().loadModel(baseModel);
    await flushFrame();

    const state = useLLMStore.getState();
    expect(state.activeChatMessages).toEqual([placeholder]);
    expect(state.performance).toEqual({ tokenCount: 0, firstTokenTime: 0 });
    expect(state.isProcessingPrompt).toBe(true);
    expect(state.isGenerating).toBe(false);
    expect(state.generationError).toBeNull();
    expect(Feedback.Feedback.firstToken).not.toHaveBeenCalled();
    expect(mockPersistMessage).not.toHaveBeenCalled();
  });

  it('holds a message sent meanwhile until it is over, then gives it a clean generation', async () => {
    const finishWarmup = warmupThatWaits();
    const loading = useLLMStore.getState().loadModel(baseModel);
    expect(
      await until(() => mockInstance.generate.mock.calls.length === 1)
    ).toBe(true);

    mockInstance.generate.mockImplementationOnce(async () => {
      capturedTokenCallback!('The answer.');
      await flushFrame();
      return 'The answer.';
    });
    useLLMStore.setState({ activeChatId: 1, activeChatMessages: [] });
    const turn = useLLMStore
      .getState()
      .sendChatMessage('question', 1, noSources, settings);

    expect(await until(() => mockInstance.generate.mock.calls.length > 1)).toBe(
      false
    );

    capturedTokenCallback!('Hel');
    expect(mockInstance.interrupt).toHaveBeenCalledTimes(1);
    finishWarmup('Hel');
    await loading;
    await turn;

    expect(mockInstance.generate.mock.calls[1][0]).toContainEqual({
      role: 'user',
      content: 'hello',
    });
    expect(mockInstance.interrupt).toHaveBeenCalledTimes(1);
    expect(useLLMStore.getState().activeChatMessages.at(-1)?.content).toBe(
      'The answer.'
    );
    expect(useLLMStore.getState().generationError).toBeNull();
  });

  it('does not fail the load when it throws', async () => {
    mockInstance.generate.mockRejectedValueOnce(new Error('Metal said no'));

    await useLLMStore.getState().loadModel(baseModel);

    expect(useLLMStore.getState().isLoading).toBe(false);
    expect(useLLMStore.getState().model).toEqual(baseModel);
    expect(mockInstance.delete).not.toHaveBeenCalled();
    expect(useLLMStore.getState().generationError).toBeNull();
  });

  describe('against the clock', () => {
    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('interrupts a warm-up that hangs and lets the load finish', async () => {
      const finishWarmup = warmupThatWaits();
      let loaded = false;
      const loading = useLLMStore
        .getState()
        .loadModel(baseModel)
        .then(() => {
          loaded = true;
        });

      await jest.advanceTimersByTimeAsync(MODEL_WARMUP_TIMEOUT_MS - 1);
      expect(loaded).toBe(false);
      expect(mockInstance.interrupt).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);
      await loading;

      expect(mockInstance.interrupt).toHaveBeenCalledTimes(1);
      expect(useLLMStore.getState().isLoading).toBe(false);
      expect(useLLMStore.getState().model).toEqual(baseModel);
      finishWarmup('');
    });

    it('never touches the model loaded in its place', async () => {
      const firstInstance = mockInstance;
      const finishFirstWarmup = warmupThatWaits(firstInstance);
      const firstLoad = useLLMStore.getState().loadModel(baseModel);
      await jest.advanceTimersByTimeAsync(MODEL_WARMUP_TIMEOUT_MS);
      await firstLoad;
      const firstTokenCallback = capturedTokenCallback!;

      const secondInstance = makeMockInstance();
      mockLLMModule.fromModelName.mockImplementationOnce(
        async (_namedSources, _onProgress, onToken) => {
          capturedTokenCallback = onToken;
          return secondInstance as unknown as LLMModule;
        }
      );
      const otherModel = { ...baseModel, id: 2, modelName: 'Other LLM' };
      const switching = useLLMStore.getState().loadModel(otherModel);
      await jest.advanceTimersByTimeAsync(0);

      firstTokenCallback('late');
      finishFirstWarmup('late');
      await jest.advanceTimersByTimeAsync(MODEL_WARMUP_TIMEOUT_MS);
      await switching;

      expect(firstInstance.delete).toHaveBeenCalledTimes(1);
      expect(secondInstance.generate).toHaveBeenCalledTimes(1);
      expect(secondInstance.interrupt).not.toHaveBeenCalled();
      expect(useLLMStore.getState().model).toEqual(otherModel);
    });
  });

  it('makes a benchmark started meanwhile wait for it', async () => {
    const finishWarmup = warmupThatWaits();
    const loading = useLLMStore.getState().loadModel(baseModel);
    expect(
      await until(() => mockInstance.generate.mock.calls.length === 1)
    ).toBe(true);

    const configuredBefore = mockInstance.configure.mock.calls.length;
    const benchmark = useLLMStore.getState().runBenchmark();

    expect(
      await until(
        () => mockInstance.configure.mock.calls.length > configuredBefore
      )
    ).toBe(false);
    expect(mockInstance.generate).toHaveBeenCalledTimes(1);

    finishWarmup('');
    await loading;
    await benchmark;

    expect(mockInstance.generate).toHaveBeenCalledTimes(2);
    expect(mockInstance.generate.mock.calls[1][0]).toContainEqual({
      role: 'user',
      content: 'benchmark prompt text',
    });
  });
});

describe('loading a model whose files were deleted', () => {
  it('refuses instead of fetching the whole model again behind a spinner (C-93)', async () => {
    const { useModelStore } = jest.requireActual('../store/modelStore');
    const Toast = jest.requireActual('react-native-toast-message').default;
    const show = jest.spyOn(Toast, 'show');
    const deleted = { ...baseModel, id: 77, isDownloaded: false };
    useModelStore.setState({ models: [deleted] });
    const fromModelName = jest.spyOn(LLMModule, 'fromModelName');

    await useLLMStore.getState().loadModel({ ...deleted, isDownloaded: true });

    expect(fromModelName).not.toHaveBeenCalled();
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        text1: expect.stringContaining('is not downloaded'),
      })
    );
    useModelStore.setState({ models: [] });
  });
});
