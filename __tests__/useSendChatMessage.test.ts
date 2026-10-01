import { Keyboard } from 'react-native';
import { useSendChatMessage } from '../components/chat-screen/useSendChatMessage';
import { useLLMStore } from '../store/llmStore';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Model } from '../database/modelRepository';
import type { MessagesHandle } from '../components/chat-screen/Messages';
import Toast from 'react-native-toast-message';
import { runWebSearch } from '../utils/web/runWebSearch';

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
const webEnabledByChat: Record<number, boolean> = {};
const mockSetSearchingWeb = jest.fn();
const mockPushWebSearchEvent = jest.fn();
jest.mock('../store/webSearchStore', () => ({
  useWebSearchStore: {
    getState: () => ({
      isEnabled: (chatId: number) => !!webEnabledByChat[chatId],
      resetTrace: jest.fn(),
      transfer: jest.fn(),
      setSearchingWeb: mockSetSearchingWeb,
      pushWebSearchEvent: mockPushWebSearchEvent,
    }),
  },
}));
jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn(), hide: jest.fn() },
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
    interrupt: jest.fn(() => {
      state.isGenerating = false;
      state.isProcessingPrompt = false;
      state.generatingForChatId = null;
    }),
  };
  const store = Object.assign(() => state, { getState: () => state });
  return { useLLMStore: store };
});

const mockedState = () =>
  useLLMStore.getState() as unknown as {
    isGenerating: boolean;
    isProcessingPrompt: boolean;
    generatingForChatId: number | null;
    model: { id: number; modelName: string } | null;
    sendChatMessage: jest.Mock;
    interrupt: jest.Mock;
  };

const messagesRef = {
  current: {
    onMessageSent: jest.fn(),
    cancelMessageSent: jest.fn(),
  } as unknown as MessagesHandle,
};

const useSend = (
  chatId = 1,
  loading = false,
  waitForModelSwitch?: () => Promise<void>
) =>
  useSendChatMessage({
    chatId,
    model: { id: 1, modelName: 'Test LLM' } as Model,
    messageHistory: [],
    chatSettings: {
      systemPrompt: '',
      thinkingEnabled: false,
    },
    enabledSources: [],
    vectorStore: null,
    embeddings: null,
    messagesRef,
    db: {} as SQLiteDatabase,
    isGenerating: false,
    isModelLoading: loading,
    isSwitching: !!waitForModelSwitch,
    waitForModelSwitch,
  });

beforeEach(() => {
  const state = mockedState();
  state.isGenerating = false;
  state.isProcessingPrompt = false;
  state.generatingForChatId = null;
  state.sendChatMessage.mockClear();
  state.interrupt.mockClear();
  (Toast.show as jest.Mock).mockClear();
  Object.keys(webEnabledByChat).forEach(
    (key) => delete webEnabledByChat[Number(key)]
  );
});

describe('sending while another turn is open', () => {
  it('refuses a second message for the chat that is already answering', async () => {
    const state = mockedState();
    state.isGenerating = true;
    state.generatingForChatId = 1;

    expect(await useSend(1)('again')).toBe('busy');
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
    expect(await useSend(1)('   ')).toBe('nothing-to-send');
    expect(mockedState().sendChatMessage).not.toHaveBeenCalled();
  });

  it('says the model is not ready rather than blaming a response', async () => {
    const loaded = mockedState().model;
    mockedState().model = null;
    try {
      expect(await useSend(1)('', 'file://photo.jpg')).toBe('model-loading');
      expect(mockedState().sendChatMessage).not.toHaveBeenCalled();
    } finally {
      mockedState().model = loaded;
    }
  });

  it('takes a send that arrives while the model is still coming up', async () => {
    const loaded = mockedState().model;
    mockedState().model = null;
    try {
      expect(await useSend(1, true)('', 'file://photo.jpg')).toBe(true);
      expect(mockedState().sendChatMessage).toHaveBeenCalled();
    } finally {
      mockedState().model = loaded;
    }
  });

  it('still sends while a load is in flight over a model that is already up', async () => {
    expect(await useSend(1, true)('hello')).toBe(true);
    expect(mockedState().sendChatMessage).toHaveBeenCalled();
  });
});

describe('a send that lands while the model is being switched', () => {
  it('waits for the switch instead of refusing the message', async () => {
    let settle = () => {};
    const switched = new Promise<void>((resolve) => {
      settle = resolve;
    });

    const sent = useSend(1, false, () => switched)('hello');
    expect(mockedState().sendChatMessage).not.toHaveBeenCalled();

    settle();
    expect(await sent).toBe(true);
    expect(mockedState().sendChatMessage).toHaveBeenCalled();
  });

  it('refuses only when nothing can tell it the switch is over', async () => {
    const send = useSendChatMessage({
      chatId: 1,
      model: { id: 1, modelName: 'Test LLM' } as Model,
      messageHistory: [],
      chatSettings: {
        systemPrompt: '',
        thinkingEnabled: false,
      },
      enabledSources: [],
      vectorStore: null,
      embeddings: null,
      messagesRef,
      db: {} as SQLiteDatabase,
      isGenerating: false,
      isModelLoading: false,
      isSwitching: true,
    });

    expect(await send('hello')).toBe('model-loading');
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

describe('a turn that starts while the chat is being looked up', () => {
  it('gives the composer back instead of dropping the message in an existing chat', async () => {
    const { checkIfChatExists } = jest.requireMock(
      '../database/chatRepository'
    ) as { checkIfChatExists: jest.Mock };
    const state = mockedState();

    checkIfChatExists.mockImplementationOnce(async () => {
      state.isProcessingPrompt = true;
      return true;
    });

    expect(await useSend(1)('hello')).toBe(false);

    expect(state.sendChatMessage).not.toHaveBeenCalled();
    expect(messagesRef.current?.cancelMessageSent).toHaveBeenCalled();
  });
});

describe('the web toggle the composer is showing', () => {
  it('decides the turn when the sources are built, not when the message was sent', async () => {
    webEnabledByChat[1] = true;
    const state = mockedState();

    await useSend()('what is the weather in Kraków');
    const buildSources = state.sendChatMessage.mock.calls[0][2];

    webEnabledByChat[1] = false;
    await buildSources();
    expect(Toast.show).not.toHaveBeenCalled();

    webEnabledByChat[1] = true;
    await buildSources();
    expect(Toast.show).toHaveBeenCalled();
  });
});

describe('a web search that cannot or does not finish', () => {
  const searchEndsWith = (telemetry: object) =>
    (runWebSearch as jest.Mock).mockResolvedValueOnce({
      context: [],
      sourceDocuments: [],
      telemetry: { needsSearch: true, ...telemetry },
    });

  it('tells the model and the user that the phone is offline instead of answering from memory as if it had checked', async () => {
    webEnabledByChat[1] = true;
    const state = mockedState();
    searchEndsWith({ skippedReason: 'offline' });

    await useSend()('who won yesterday');
    const built = await state.sendChatMessage.mock.calls[0][2]();

    expect(built.webSearchFailed).toBe(true);
    expect(Toast.show).toHaveBeenCalledWith({
      type: 'defaultToast',
      text1: 'You’re offline — answering without the web.',
    });
  });

  it('says nothing when the question never needed a search', async () => {
    webEnabledByChat[1] = true;
    const state = mockedState();
    searchEndsWith({ skippedReason: 'gated' });

    await useSend()('tell me a joke');
    const built = await state.sendChatMessage.mock.calls[0][2]();

    expect(built.webSearchFailed).toBe(false);
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it('leaves the searching state and trace to the next turn once this one is stopped', async () => {
    webEnabledByChat[1] = true;
    const state = mockedState();
    const stop = new AbortController();
    mockSetSearchingWeb.mockClear();
    mockPushWebSearchEvent.mockClear();
    (runWebSearch as jest.Mock).mockImplementationOnce(
      async ({ onProgress }: { onProgress: (event: object) => void }) => {
        stop.abort();
        onProgress({ type: 'ranking' });
        return { context: [], sourceDocuments: [], telemetry: {} };
      }
    );

    await useSend()('latest news');
    await state.sendChatMessage.mock.calls[0][2](stop.signal);

    expect(mockPushWebSearchEvent).not.toHaveBeenCalled();
    expect(mockSetSearchingWeb).not.toHaveBeenCalledWith(false);
  });
});
