import { useLLMStore } from '../store/llmStore';
import { LLMModule } from 'react-native-executorch/legacy';
import * as chatRepository from '../database/chatRepository';
import type { Message } from '../database/chatRepository';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useSettingsStore } from '../store/settingsStore';
import { memoryStrainedSince, releaseMlxCache } from '../modules/memory-probe';

jest.mock('../modules/memory-probe', () => ({
  isMemoryMetricAvailable: () => false,
  memorySampleIntervalMs: () => 250,
  getMemoryFootprintBytes: () => null,
  releaseMlxCache: jest.fn(),
  memoryStrainedSince: jest.fn(() => true),
}));

const mockMemoryStrainedSince = memoryStrainedSince as jest.Mock;
jest.mock('../database/chatRepository');
jest.mock('../utils/Feedback', () => ({
  Feedback: { firstToken: jest.fn() },
}));
jest.mock('../utils/promptUtils', () => ({
  prepareMessagesForLLM: jest.fn(() => [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'hello' },
  ]),
  answerLanguageAnchor: jest.fn(() => ''),
  focusedRetrySystemPrompt: jest.fn(() => ''),
}));
jest.mock('../utils/cpuSupport', () => ({
  cpuLacksLseAtomics: () => Promise.resolve(false),
}));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn().mockResolvedValue({ isConnected: true }) },
}));

const mockLLMModule = LLMModule as jest.Mocked<typeof LLMModule>;
const mockPersistMessage = chatRepository.persistMessage as jest.Mock;
const mockMarkMessageCutShort = chatRepository.markMessageCutShort as jest.Mock;

const mockDb = {} as unknown as SQLiteDatabase;
const settings = { systemPrompt: 'be helpful' };
const noSources = async () => ({
  context: [] as string[],
  sourceDocuments: [],
  preferredSourceDocuments: [],
});

const gemma = {
  id: 7,
  modelName: 'Gemma 4 - 2B',
  source: 'remote' as const,
  isDownloaded: true,
  modelPath: 'https://example.com/gemma/mlx/model.pte',
  tokenizerPath: 'https://example.com/tokenizer.json',
  tokenizerConfigPath: 'https://example.com/tokenizer_config.json',
};

const qwen = {
  ...gemma,
  id: 3,
  modelName: 'Qwen 2.5 - 0.5B',
  modelPath: 'https://example.com/qwen/xnnpack/model.pte',
};

const makeInstance = () => ({
  generate: jest.fn(),
  interrupt: jest.fn(),
  delete: jest.fn(),
  configure: jest.fn(),
  getGeneratedTokenCount: jest.fn(() => 3),
  lastGenerationStalled: jest.fn(() => false),
});

let instance = makeInstance();

const settle = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const loadGemma = async () => {
  await useLLMStore.getState().loadModel(gemma);
  instance.generate.mockReset();
  instance.lastGenerationStalled.mockReset();
};

const stallNextTurn = (partial: string) => {
  instance.generate.mockResolvedValueOnce(partial);
  instance.lastGenerationStalled.mockReturnValueOnce(true);
};

const send = () =>
  useLLMStore.getState().sendChatMessage('Tell me about Rome', 1, noSources, {
    ...settings,
  });

const messages = (): Message[] => useLLMStore.getState().activeChatMessages;

beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  instance = makeInstance();
  mockMemoryStrainedSince.mockReturnValue(true);
  mockLLMModule.fromModelName.mockImplementation(
    async () => instance as unknown as LLMModule
  );
  mockPersistMessage.mockResolvedValue(42);
  useSettingsStore.setState({ hasHydrated: true, customSystemPrompt: '' });
  useLLMStore.setState({
    isLoading: false,
    isGenerating: false,
    isProcessingPrompt: false,
    isBenchmarking: false,
    db: mockDb,
    model: null,
    activeChatId: 1,
    generatingForChatId: null,
    activeChatMessages: [],
    generationError: null,
    retryArmedForChatId: null,
    memoryStalls: {},
  });
  await loadGemma();
});

afterEach(async () => {
  await settle();
  jest.restoreAllMocks();
});

describe('a turn the memory stall cut short', () => {
  it('keeps the partial answer and marks it as cut short by memory', async () => {
    stallNextTurn('Rome was founded in 753 BC and');

    await send();

    expect(mockPersistMessage).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        role: 'assistant',
        content: 'Rome was founded in 753 BC and',
        cutShortReason: 'memory',
      })
    );
    const answer = messages().find((message) => message.role === 'assistant');
    expect(answer?.content).toBe('Rome was founded in 753 BC and');
    expect(answer?.cutShortReason).toBe('memory');
    expect(answer?.stoppedByUser).toBeFalsy();
  });

  it('marks the question too, so the cut turn stays out of later prompts', async () => {
    stallNextTurn('Rome was founded in 753 BC and');

    await send();

    expect(mockMarkMessageCutShort).toHaveBeenCalledWith(mockDb, 42, 'memory');
  });

  it('unloads the stalled model', async () => {
    stallNextTurn('Rome was');

    await send();
    await settle();

    expect(instance.delete).toHaveBeenCalled();
  });

  it('gives the MLX buffer cache back to the system with the stalled model', async () => {
    stallNextTurn('It began in');
    await send();
    await settle();

    expect(releaseMlxCache).toHaveBeenCalledTimes(1);
  });

  it('leaves the MLX cache alone when a model off the MLX delegate is unloaded', async () => {
    await useLLMStore.getState().loadModel(qwen);
    (releaseMlxCache as jest.Mock).mockClear();

    await useLLMStore.getState().loadModel(gemma);

    expect(releaseMlxCache).not.toHaveBeenCalled();
  });

  it('never shows the generic failure, even when nothing was decoded yet', async () => {
    stallNextTurn('');

    await send();

    expect(useLLMStore.getState().generationError).toBeNull();
    expect(
      messages().some(
        (message) => message.role === 'assistant' && message.id === -1
      )
    ).toBe(false);
    expect(mockMarkMessageCutShort).toHaveBeenCalledWith(mockDb, 42, 'memory');
    expect(
      messages().find((message) => message.role === 'user')?.cutShortReason
    ).toBe('memory');
  });

  it('records which model stalled in which chat and arms a retry of the same question', async () => {
    stallNextTurn('');

    await send();

    expect(useLLMStore.getState().memoryStalls).toEqual({ 1: gemma.id });
    expect(useLLMStore.getState().retryArmedForChatId).toBe(1);
  });

  it('does not run a follow-up generation on the model that just stalled', async () => {
    const danglingList = 'Here are the main sights of Rome:';
    instance.generate.mockResolvedValueOnce(danglingList);
    instance.generate.mockResolvedValueOnce('1. The Colosseum');
    await send();
    expect(instance.generate.mock.calls.length).toBeGreaterThan(1);

    await loadGemma();
    stallNextTurn(danglingList);
    await send();

    expect(instance.generate).toHaveBeenCalledTimes(1);
  });

  it('ends as a turn the user stopped when Stop lands on a stalled pass', async () => {
    instance.generate.mockImplementationOnce(async () => {
      useLLMStore.getState().interrupt();
      return 'Rome was founded';
    });
    instance.lastGenerationStalled.mockReturnValueOnce(true);

    await send();

    expect(useLLMStore.getState().memoryStalls).toEqual({});
    expect(mockPersistMessage).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ role: 'assistant', stoppedByUser: true })
    );
    expect(mockPersistMessage).not.toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ cutShortReason: 'memory' })
    );
  });

  it('shows no memory card for a stall in a turn the app left the foreground during', async () => {
    instance.generate.mockImplementationOnce(async () => {
      useLLMStore.getState().appLeftForeground();
      return 'Rome was founded in 753 BC and';
    });
    instance.lastGenerationStalled.mockReturnValueOnce(true);

    await send();
    useLLMStore.getState().appReturnedToForeground();

    expect(useLLMStore.getState().memoryStalls).toEqual({});
    expect(mockMarkMessageCutShort).not.toHaveBeenCalledWith(
      mockDb,
      expect.anything(),
      'memory'
    );
  });

  it('shows no memory card unless iOS itself reported memory pressure around the turn', async () => {
    mockMemoryStrainedSince.mockReturnValue(false);
    stallNextTurn('Rome was founded in 753 BC and');

    await send();

    expect(useLLMStore.getState().memoryStalls).toEqual({});
    expect(mockMarkMessageCutShort).not.toHaveBeenCalledWith(
      mockDb,
      expect.anything(),
      'memory'
    );
  });

  it('asks about memory pressure from the moment this turn started', async () => {
    const before = Date.now();
    stallNextTurn('Rome was founded in 753 BC and');

    await send();

    const [sinceMs] = mockMemoryStrainedSince.mock.calls[0];
    expect(sinceMs).toBeGreaterThanOrEqual(before);
    expect(sinceMs).toBeLessThanOrEqual(Date.now());
  });

  it('leaves a healthy turn alone', async () => {
    instance.generate.mockResolvedValueOnce('Rome was founded in 753 BC.');

    await send();

    expect(useLLMStore.getState().memoryStalls).toEqual({});
    expect(mockMarkMessageCutShort).not.toHaveBeenCalledWith(
      mockDb,
      expect.anything(),
      'memory'
    );
    expect(instance.delete).not.toHaveBeenCalled();
  });

  it('forgets the stall once the next turn in the chat starts', async () => {
    stallNextTurn('');
    await send();
    await settle();
    expect(useLLMStore.getState().memoryStalls).toEqual({ 1: gemma.id });

    instance.generate.mockResolvedValue('Rome was founded in 753 BC.');
    await send();

    expect(useLLMStore.getState().memoryStalls).toEqual({});
  });

  it('loads the stalled model again for the next send, without asking', async () => {
    stallNextTurn('');
    await send();
    await settle();
    mockLLMModule.fromModelName.mockClear();

    instance.generate.mockResolvedValue('Rome was founded in 753 BC.');
    await send();

    expect(mockLLMModule.fromModelName).toHaveBeenCalled();
    expect(
      messages().find((message) => message.role === 'assistant')?.content
    ).toBe('Rome was founded in 753 BC.');
  });

  it('answers with a smaller model loaded after the stall without loading it a second time', async () => {
    stallNextTurn('');
    await send();
    await settle();
    await useLLMStore.getState().loadModel(qwen);
    mockLLMModule.fromModelName.mockClear();

    instance.generate.mockResolvedValue('Rome was founded in 753 BC.');
    await useLLMStore.getState().retryLastGeneration();

    expect(mockLLMModule.fromModelName).not.toHaveBeenCalled();
    expect(
      messages().find((message) => message.role === 'assistant')?.content
    ).toBe('Rome was founded in 753 BC.');
  });

  it('drops the cut-short mark from the question when the turn is retried', async () => {
    stallNextTurn('');
    await send();
    await settle();

    instance.generate.mockResolvedValue('Rome was founded in 753 BC.');
    await useLLMStore.getState().retryLastGeneration();

    expect(mockMarkMessageCutShort).toHaveBeenCalledWith(mockDb, 42, null);
    expect(
      messages().find((message) => message.role === 'user')?.cutShortReason
    ).toBeUndefined();
  });
});
