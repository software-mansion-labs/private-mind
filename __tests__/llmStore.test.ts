import { useLLMStore } from '../store/llmStore';
import { LLMModule } from 'react-native-executorch';
import * as chatRepository from '../database/chatRepository';
import type { Message } from '../database/chatRepository';
import type { Model } from '../database/modelRepository';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as Feedback from '../utils/Feedback';
import { prepareMessagesForLLM } from '../utils/promptUtils';
import { useSettingsStore } from '../store/settingsStore';

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
}));
jest.mock('../constants/default-benchmark', () => ({
  BENCHMARK_PROMPT: 'benchmark prompt text',
}));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn().mockResolvedValue({ isConnected: true }) },
}));

const mockLLMModule = LLMModule as jest.Mocked<typeof LLMModule>;
const mockPersistMessage = chatRepository.persistMessage as jest.Mock;
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

beforeEach(() => {
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

  it('appends token to last active message when generating for active chat', async () => {
    const onToken = await loadModel();
    useLLMStore.setState({
      isProcessingPrompt: false,
      isGenerating: true,
      activeChatId: 5,
      generatingForChatId: 5,
      performance: { tokenCount: 1, firstTokenTime: 1 },
      activeChatMessages: [
        { id: 1, chatId: 5, role: 'user', content: 'Hi', timestamp: 0 },
        { id: -1, chatId: 5, role: 'assistant', content: '', timestamp: 0 },
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

  it('does nothing when neither generating nor processing', () => {
    useLLMStore.setState({ isGenerating: false, isProcessingPrompt: false });
    expect(() => useLLMStore.getState().interrupt()).not.toThrow();
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

  it('persists user message and assistant response', async () => {
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('hello', 1, noSources, settings);

    expect(mockPersistMessage).toHaveBeenCalledTimes(2);
    expect(mockPersistMessage).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ role: 'user', content: 'hello' })
    );
    expect(mockPersistMessage).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        role: 'assistant',
        content: 'The answer is 42.',
      })
    );
  });

  it('sets isProcessingPrompt at start and clears it on complete', async () => {
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('hello', 1, noSources, settings);

    expect(useLLMStore.getState().isProcessingPrompt).toBe(false);
    expect(useLLMStore.getState().isGenerating).toBe(false);
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
      .sendChatMessage('hello', 1, noSources, settings);

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
      .sendChatMessage('hello', 1, noSources, settings);

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
      .mockResolvedValueOnce('Recovered answer');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore
      .getState()
      .sendChatMessage('hello', 1, noSources, settings);
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
    expect(shown).toContain('Nie udało mi się odpowiedzieć');
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
      'could not answer this question'
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

  it('recovers via the continuation nudge when a looping list gets trimmed down to just the intro', async () => {
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
      .sendChatMessage('hello', 1, noSources, settings);

    // complete called without perf data — last message should not have timeToFirstToken
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
      .sendChatMessage('hello', 1, async () => ({ context: [] }), settings);

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

// ─── sendEventMessage ─────────────────────────────────────────────────────────

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

// ─── setActiveChatId ──────────────────────────────────────────────────────────

describe('setActiveChatId', () => {
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

// ─── refreshActiveChatMessages ────────────────────────────────────────────────

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

// ─── sendChatMessage imagePath ────────────────────────────────────────────────

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
    await loadModel();
    mockInstance.generate.mockResolvedValue('output text');
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

  it('tracks a fresh first token on every run without stale carry-over', async () => {
    await loadModel();
    useLLMStore.setState({ model: baseModel });

    // The RN jest preset aliases performance.now to Date.now (1 ms resolution),
    // so on a fast machine startTime and the first token can share a millisecond
    // and the measured delta collapses to 0. Advance a virtual clock instead.
    let now = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => (now += 10));

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
      .sendChatMessage('hello', 1, noSources, settings);

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
      .sendChatMessage('hello', 1, noSources, settings);

    expect(useLLMStore.getState().model?.modelName).toBe('Second LLM');
  });
});
