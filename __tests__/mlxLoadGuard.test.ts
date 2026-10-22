import type AsyncStorageType from '@react-native-async-storage/async-storage';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { useLLMStore as UseLLMStore } from '../store/llmStore';
import type * as ChatRepository from '../database/chatRepository';
import type { LLMModule as LLMModuleType } from 'react-native-executorch/legacy';

jest.mock('../modules/memory-probe', () => ({
  isMemoryMetricAvailable: () => false,
  memorySampleIntervalMs: () => 250,
  getMemoryFootprintBytes: () => null,
  releaseMlxCache: jest.fn(),
}));
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

const LOAD_IN_FLIGHT_KEY = 'mlx_model_load_in_flight';
const LOAD_DEATHS_KEY = 'mlx_model_load_deaths';

const mockDb = {} as unknown as SQLiteDatabase;
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
  modelName: 'Qwen 3 - 1.7B',
  modelPath: 'https://example.com/qwen/xnnpack/model.pte',
};

const makeInstance = () => ({
  generate: jest.fn().mockResolvedValue('Rome was founded in 753 BC.'),
  interrupt: jest.fn(),
  delete: jest.fn(),
  configure: jest.fn(),
  getGeneratedTokenCount: jest.fn(() => 3),
  lastGenerationStalled: jest.fn(() => false),
});

let useLLMStore: typeof UseLLMStore;
let fromModelName: jest.Mock;
let markMessageCutShort: jest.Mock;
let storage: typeof AsyncStorageType;

const freshAppLaunch = (stored: Record<string, string> = {}) => {
  jest.isolateModules(() => {
    storage = jest.requireActual<{ default: typeof AsyncStorageType }>(
      '@react-native-async-storage/async-storage'
    ).default;
    storage.clear();
    Object.entries(stored).forEach(([key, value]) => {
      storage.setItem(key, value);
    });
    useLLMStore = jest.requireActual<{ useLLMStore: typeof UseLLMStore }>(
      '../store/llmStore'
    ).useLLMStore;
    const repository = jest.requireMock<typeof ChatRepository>(
      '../database/chatRepository'
    );
    (repository.persistMessage as jest.Mock).mockResolvedValue(42);
    markMessageCutShort = repository.markMessageCutShort as jest.Mock;
    fromModelName = jest.requireActual<{
      LLMModule: typeof LLMModuleType;
    }>('react-native-executorch/legacy').LLMModule.fromModelName as jest.Mock;
    fromModelName.mockImplementation(async () => makeInstance());
    jest
      .requireActual<{
        useSettingsStore: { setState: (state: object) => void };
      }>('../store/settingsStore')
      .useSettingsStore.setState({
        hasHydrated: true,
        customSystemPrompt: '',
      });
  });
  useLLMStore.setState({ db: mockDb, activeChatId: 1 });
};

const settle = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const send = () =>
  useLLMStore
    .getState()
    .sendChatMessage('Tell me about Rome', 1, noSources, { systemPrompt: '' });

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(async () => {
  await settle();
  jest.restoreAllMocks();
});

describe('Gemma that took the app down while starting', () => {
  it('is not loaded again by itself on the next launch', async () => {
    freshAppLaunch({ [LOAD_IN_FLIGHT_KEY]: String(gemma.id) });

    await useLLMStore.getState().loadModel(gemma);

    expect(fromModelName).not.toHaveBeenCalled();
    expect(useLLMStore.getState().model?.id).toBe(gemma.id);
  });

  it('answers the next question with the card saying it could not start', async () => {
    freshAppLaunch({ [LOAD_IN_FLIGHT_KEY]: String(gemma.id) });
    await useLLMStore.getState().loadModel(gemma);

    await send();

    expect(fromModelName).not.toHaveBeenCalled();
    expect(useLLMStore.getState().memoryStalls).toEqual({ 1: gemma.id });
    expect(useLLMStore.getState().failedToStartIn).toEqual({ 1: gemma.id });
    expect(useLLMStore.getState().retryArmedForChatId).toBe(1);
    expect(markMessageCutShort).toHaveBeenCalledWith(mockDb, 42, 'memory');
  });

  it('loads Gemma when the user asks again after the card', async () => {
    freshAppLaunch({ [LOAD_IN_FLIGHT_KEY]: String(gemma.id) });
    await useLLMStore.getState().loadModel(gemma);
    await send();
    await settle();

    await send();

    expect(fromModelName).toHaveBeenCalledTimes(1);
    expect(useLLMStore.getState().failedToStartIn).toEqual({});
  });

  it('counts the launch that found Gemma had not finished starting', async () => {
    freshAppLaunch({
      [LOAD_DEATHS_KEY]: '2',
      [LOAD_IN_FLIGHT_KEY]: String(gemma.id),
    });

    await useLLMStore.getState().loadModel(gemma);

    expect(await storage.getItem(LOAD_DEATHS_KEY)).toBe('3');
  });

  it('does not hold back another model', async () => {
    freshAppLaunch({ [LOAD_IN_FLIGHT_KEY]: String(qwen.id) });

    await useLLMStore.getState().loadModel(gemma);

    expect(fromModelName).toHaveBeenCalledTimes(1);
  });
});

describe('the marker around an MLX model load', () => {
  it('is gone once Gemma has started', async () => {
    freshAppLaunch();

    await useLLMStore.getState().loadModel(gemma);

    expect(fromModelName).toHaveBeenCalledTimes(1);
    expect(await storage.getItem(LOAD_IN_FLIGHT_KEY)).toBeNull();
  });

  it('is left behind while Gemma is still starting', async () => {
    freshAppLaunch();
    fromModelName.mockImplementation(() => new Promise(() => {}));

    useLLMStore.getState().loadModel(gemma);
    await settle();

    expect(await storage.getItem(LOAD_IN_FLIGHT_KEY)).toBe(String(gemma.id));
  });

  it('is cleared when the app goes to the background mid-load', async () => {
    freshAppLaunch();
    fromModelName.mockImplementation(() => new Promise(() => {}));
    useLLMStore.getState().loadModel(gemma);
    await settle();

    useLLMStore.getState().appWentToBackground();
    await settle();
    useLLMStore.getState().appReturnedToForeground();

    expect(await storage.getItem(LOAD_IN_FLIGHT_KEY)).toBeNull();
  });

  it('is never written for a model off the MLX delegate', async () => {
    freshAppLaunch();
    fromModelName.mockImplementation(() => new Promise(() => {}));

    useLLMStore.getState().loadModel(qwen);
    await settle();

    expect(await storage.getItem(LOAD_IN_FLIGHT_KEY)).toBeNull();
  });
});
