import { useLLMStore } from '../store/llmStore';
import { LLMModule } from 'react-native-executorch';
import * as chatRepository from '../database/chatRepository';
import * as Feedback from '../utils/Feedback';
import { prepareMessagesForLLM } from '../utils/promptUtils';

jest.mock('../database/chatRepository');
jest.mock('../utils/Feedback', () => ({
  Feedback: { success: jest.fn() },
}));
jest.mock('../utils/promptUtils', () => ({
  prepareMessagesForLLM: jest.fn(() => [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: '' },
  ]),
}));
jest.mock('../constants/default-benchmark', () => ({
  BENCHMARK_PROMPT: 'benchmark prompt text',
}));

const mockLLMModule = LLMModule as jest.Mocked<typeof LLMModule>;
const mockPersistMessage = chatRepository.persistMessage as jest.Mock;
const mockGetChatMessages = chatRepository.getChatMessages as jest.Mock;

const mockDb = {} as any;

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
let capturedTokenCallback: ((token: string) => void) | null = null;

const makeMockInstance = () => ({
  generate: jest.fn(),
  interrupt: jest.fn(),
  delete: jest.fn(),
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
      return mockInstance as any;
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
  });

  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  // Re-apply the fromModelName mock after clearAllMocks
  mockLLMModule.fromModelName.mockImplementation(
    async (_namedSources, _onProgress, onToken) => {
      capturedTokenCallback = onToken;
      return mockInstance as any;
    }
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Helper to load a model and get the registered token callback
const loadModel = async (model = baseModel) => {
  await useLLMStore.getState().loadModel(model);
  return capturedTokenCallback!;
};

// ─── loadModel ───────────────────────────────────────────────────────────────

describe('loadModel', () => {
  it('sets isLoading during load then clears it', async () => {
    let wasLoading = false;
    mockLLMModule.fromModelName.mockImplementation(async (...args) => {
      wasLoading = useLLMStore.getState().isLoading;
      capturedTokenCallback = args[4];
      return mockInstance as any;
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
      capturedTokenCallback = args[4];
      return mockInstance as any;
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
});

// ─── token callback ───────────────────────────────────────────────────────────

describe('token callback', () => {
  it('increments tokenCount on each token', async () => {
    const onToken = await loadModel();
    useLLMStore.setState({ isProcessingPrompt: true, isGenerating: true });

    onToken('hello');
    onToken(' world');

    expect(useLLMStore.getState().performance.tokenCount).toBe(2);
  });

  it('sets firstTokenTime only on first token', async () => {
    const onToken = await loadModel();
    useLLMStore.setState({ isProcessingPrompt: true, isGenerating: true });

    onToken('first');
    const firstTime = useLLMStore.getState().performance.firstTokenTime;

    onToken('second');
    expect(useLLMStore.getState().performance.firstTokenTime).toBe(firstTime);
  });

  it('triggers Feedback.success on first token when not benchmarking', async () => {
    const onToken = await loadModel();
    useLLMStore.setState({
      isProcessingPrompt: true,
      isGenerating: true,
      isBenchmarking: false,
    });

    onToken('first');

    expect(Feedback.Feedback.success).toHaveBeenCalledTimes(1);
  });

  it('does not trigger Feedback.success during benchmarking', async () => {
    const onToken = await loadModel();
    useLLMStore.setState({
      isProcessingPrompt: true,
      isGenerating: true,
      isBenchmarking: true,
    });

    onToken('first');

    expect(Feedback.Feedback.success).not.toHaveBeenCalled();
  });

  it('appends token to last active message when generating for active chat', async () => {
    const onToken = await loadModel();
    useLLMStore.setState({
      isProcessingPrompt: false,
      isGenerating: true,
      activeChatId: 5,
      generatingForChatId: 5,
      performance: { tokenCount: 1, firstTokenTime: 1 }, // not first token
      activeChatMessages: [
        { id: 1, chatId: 5, role: 'user', content: 'Hi', timestamp: 0 },
        { id: -1, chatId: 5, role: 'assistant', content: '', timestamp: 0 },
      ],
    });

    onToken(' hello');

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
    await useLLMStore.getState().sendChatMessage('hi', 1, [], settings);
    expect(mockPersistMessage).not.toHaveBeenCalled();
  });

  it('returns early when model is not loaded', async () => {
    useLLMStore.setState({ model: null });
    await useLLMStore.getState().sendChatMessage('hi', 1, [], settings);
    expect(mockPersistMessage).not.toHaveBeenCalled();
  });

  it('persists user message and assistant response', async () => {
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore.getState().sendChatMessage('hello', 1, [], settings);

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

    await useLLMStore.getState().sendChatMessage('hello', 1, [], settings);

    expect(useLLMStore.getState().isProcessingPrompt).toBe(false);
    expect(useLLMStore.getState().isGenerating).toBe(false);
  });

  it('adds user message and assistant placeholder to activeChatMessages before generating', async () => {
    let messagesBeforeGenerate: any[] = [];
    mockInstance.generate.mockImplementation(async () => {
      messagesBeforeGenerate = useLLMStore.getState().activeChatMessages;
      return 'response';
    });
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore.getState().sendChatMessage('ping', 1, [], settings);

    expect(messagesBeforeGenerate).toHaveLength(2);
    expect(messagesBeforeGenerate[0].role).toBe('user');
    expect(messagesBeforeGenerate[1].role).toBe('assistant');
    expect(messagesBeforeGenerate[1].content).toBe('');
  });

  it('recovers gracefully when generation returns null', async () => {
    mockInstance.generate.mockResolvedValue(null);
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 1,
      activeChatMessages: [],
    });

    await useLLMStore.getState().sendChatMessage('hello', 1, [], settings);

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

    await useLLMStore.getState().sendChatMessage('hello', 1, [], settings);

    expect(useLLMStore.getState().isGenerating).toBe(false);
    expect(useLLMStore.getState().isProcessingPrompt).toBe(false);
  });

  it('does not update performance metrics on last message when user navigated away', async () => {
    mockInstance.generate.mockResolvedValue('response');
    useLLMStore.setState({
      model: baseModel,
      activeChatId: 99, // different from chatId=1
      activeChatMessages: [],
    });

    await useLLMStore.getState().sendChatMessage('hello', 1, [], settings);

    // complete called without perf data — last message should not have timeToFirstToken
    const messages = useLLMStore.getState().activeChatMessages;
    const lastMsg = messages[messages.length - 1];
    expect(lastMsg?.timeToFirstToken).toBeUndefined();
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
      } as any,
      activeChatId: 1,
      activeChatMessages: [],
    });
  });

  it('passes imagePath to persistMessage for user message when provided', async () => {
    await useLLMStore
      .getState()
      .sendChatMessage('What is this?', 1, [], settings, '/local/image.jpg');

    expect(mockPersistMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ imagePath: '/local/image.jpg', role: 'user' })
    );
  });

  it('passes undefined imagePath to persistMessage when not provided', async () => {
    await useLLMStore.getState().sendChatMessage('Hello', 1, [], settings);

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
      .sendChatMessage('What is this?', 1, [], settings, '/local/image.jpg');

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
});
