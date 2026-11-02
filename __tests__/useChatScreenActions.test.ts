import { renderHook, act } from '@testing-library/react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useChatScreenActions } from '../components/chat-screen/useChatScreenActions';
import type { Model } from '../database/modelRepository';

const mockLoadModel = jest.fn(async () => {});
const mockLlm = { model: null as Model | null, loadModel: mockLoadModel };

jest.mock('../store/llmStore', () => ({ useLLMStore: () => mockLlm }));
jest.mock('../store/modelStore', () => ({
  useModelStore: () => ({ getModelById: jest.fn() }),
}));
jest.mock('../store/chatStore', () => ({
  useChatStore: () => ({
    phantomChat: null,
    setPhantomChatSettings: jest.fn(),
  }),
}));
jest.mock('../database/chatRepository', () => ({
  checkIfChatExists: jest.fn(async () => false),
  setChatSettings: jest.fn(),
}));
jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

const gemma = { id: 2, modelName: 'Gemma 4 - 2B', isDownloaded: true } as Model;
const qwen = { id: 1, modelName: 'Qwen 3 - 1.7B', isDownloaded: true } as Model;

const setInput = jest.fn();

const useActions = (modelSwitching: boolean) =>
  useChatScreenActions({
    chatId: 7,
    chat: undefined,
    model: gemma,
    chatSettings: {
      systemPrompt: '',
      thinkingEnabled: false,
      webSearchEnabled: false,
    },
    setSetting: jest.fn(),
    db: {} as SQLiteDatabase,
    inputRef: { current: { setInput } },
    modelSwitching,
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockLlm.model = null;
});

describe('a suggested prompt', () => {
  it('fills the field and warms up the model the chat is on', async () => {
    const { result } = renderHook(() => useActions(false));

    await act(() => result.current.handleSelectPrompt('Explain a concept'));

    expect(setInput).toHaveBeenCalledWith('Explain a concept');
    expect(mockLoadModel).toHaveBeenCalledWith(gemma);
  });

  it('leaves a model that is already in memory alone', async () => {
    mockLlm.model = gemma;
    const { result } = renderHook(() => useActions(false));

    await act(() => result.current.handleSelectPrompt('Explain a concept'));

    expect(mockLoadModel).not.toHaveBeenCalled();
  });

  it('does not load the model being left back while a switch is loading the next one', async () => {
    mockLlm.model = qwen;
    const { result } = renderHook(() => useActions(true));

    await act(() => result.current.handleSelectPrompt('Explain a concept'));

    expect(setInput).toHaveBeenCalledWith('Explain a concept');
    expect(mockLoadModel).not.toHaveBeenCalled();
  });
});
