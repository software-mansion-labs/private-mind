import { Keyboard } from 'react-native';
import { useSendChatMessage } from '../components/chat-screen/useSendChatMessage';
import { useLLMStore } from '../store/llmStore';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Model } from '../database/modelRepository';
import type { MessagesHandle } from '../components/chat-screen/Messages';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('../database/chatRepository', () => ({
  checkIfChatExists: jest.fn(async () => true),
}));
jest.mock('../utils/persistImage', () => ({
  persistImage: jest.fn(async (path: string) => path),
}));
jest.mock('../utils/messageSources', () => ({
  buildMessageSources: jest.fn(async () => ({
    context: [],
    sourceDocuments: [],
    preferredSourceDocuments: [],
  })),
}));
jest.mock('../utils/web/runWebSearch', () => ({ runWebSearch: jest.fn() }));
jest.mock('../utils/web/scrape/webViewScrapeProvider', () => ({
  webViewScrapeProvider: { releaseHost: jest.fn() },
}));
jest.mock('../utils/network', () => ({ isDeviceOnline: async () => true }));
jest.mock('../store/chatStore', () => ({
  useChatStore: () => ({
    addChat: jest.fn(async () => 9),
    updateLastUsed: jest.fn(),
    enableSource: jest.fn(),
  }),
}));
jest.mock('../store/sourceStore', () => ({
  useSourceStore: { getState: () => ({ sources: [] }) },
}));
jest.mock('../store/webSearchStore', () => ({
  useWebSearchStore: {
    getState: () => ({
      resetTrace: jest.fn(),
      transfer: jest.fn(),
      setSearchingWeb: jest.fn(),
      pushWebSearchEvent: jest.fn(),
    }),
  },
}));
jest.mock('../store/embeddingModelStore', () => ({
  useEmbeddingModelStore: { getState: () => ({ status: 'idle' }) },
}));
jest.mock('../store/llmStore', () => {
  const state = {
    isGenerating: false,
    isProcessingPrompt: false,
    generatingForChatId: null as number | null,
    model: { id: 1, modelName: 'Test LLM' },
    activeChatDigest: null,
    sendChatMessage: jest.fn(async () => true),
    runWithModelOffloaded: jest.fn(),
    interrupt: jest.fn(),
  };
  const store = Object.assign(() => state, { getState: () => state });
  return { useLLMStore: store };
});

const mockedState = () =>
  useLLMStore.getState() as unknown as {
    isGenerating: boolean;
    isProcessingPrompt: boolean;
    generatingForChatId: number | null;
    sendChatMessage: jest.Mock;
    interrupt: jest.Mock;
  };

const messagesRef = {
  current: {
    onMessageSent: jest.fn(),
    cancelMessageSent: jest.fn(),
  } as unknown as MessagesHandle,
};

const useSend = (chatId = 1) =>
  useSendChatMessage({
    chatId,
    model: { id: 1, modelName: 'Test LLM' } as Model,
    messageHistory: [],
    chatSettings: {
      systemPrompt: '',
      thinkingEnabled: false,
      webSearchEnabled: false,
    },
    enabledSources: [],
    vectorStore: null,
    embeddings: null,
    messagesRef,
    db: {} as SQLiteDatabase,
    isGenerating: false,
    isModelLoading: false,
    isSwitching: false,
  });

beforeEach(() => {
  const state = mockedState();
  state.isGenerating = false;
  state.isProcessingPrompt = false;
  state.generatingForChatId = null;
  state.sendChatMessage.mockClear();
  state.interrupt.mockClear();
});

describe('sending while another turn is open', () => {
  it('refuses a second message for the chat that is already answering', async () => {
    const state = mockedState();
    state.isGenerating = true;
    state.generatingForChatId = 1;

    expect(await useSend(1)('again')).toBe(false);
    expect(state.sendChatMessage).not.toHaveBeenCalled();
    expect(state.interrupt).not.toHaveBeenCalled();
  });

  it('stops the other chat’s turn and sends, instead of answering the old question here (Pixel: drawer → New chat)', async () => {
    const state = mockedState();
    state.isProcessingPrompt = true;
    state.generatingForChatId = 4;

    expect(await useSend(7)('Czy jest tam jedzenie vege?')).toBe(true);
    expect(state.interrupt).toHaveBeenCalledTimes(1);
    expect(state.sendChatMessage).toHaveBeenCalledWith(
      'Czy jest tam jedzenie vege?',
      7,
      expect.any(Function),
      expect.anything(),
      undefined,
      undefined
    );
  });

  it('sends normally when nothing is in flight', async () => {
    expect(await useSend(1)('hello')).toBe(true);
    expect(mockedState().interrupt).not.toHaveBeenCalled();
  });

  it('refuses an empty message', async () => {
    expect(await useSend(1)('   ')).toBe(false);
    expect(mockedState().sendChatMessage).not.toHaveBeenCalled();
  });
});

describe('the send transition', () => {
  it('arms the pin before the keyboard is told to close', async () => {
    const dismiss = jest
      .spyOn(Keyboard, 'dismiss')
      .mockImplementation(() => {});
    const onMessageSent = messagesRef.current.onMessageSent as jest.Mock;
    onMessageSent.mockClear();

    await useSend(1)('hello');

    expect(onMessageSent).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(onMessageSent.mock.invocationCallOrder[0]).toBeLessThan(
      dismiss.mock.invocationCallOrder[0]
    );
    dismiss.mockRestore();
  });
});
