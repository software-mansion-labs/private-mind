import { Keyboard } from 'react-native';
import { useSendChatMessage } from '../components/chat-screen/useSendChatMessage';
import { useLLMStore } from '../store/llmStore';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Model } from '../database/modelRepository';
import type { MessagesHandle } from '../components/chat-screen/Messages';
import Toast from 'react-native-toast-message';
import type { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import type { Attachment } from '../hooks/useAttachment';
import { runWebSearch } from '../utils/web/runWebSearch';
import { WEB_SKIP_COPY } from '../constants/web-copy';

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
jest.mock('../constants/model-profiles', () => ({
  ...jest.requireActual('../constants/model-profiles'),
  isWebSearchReady: () => true,
}));
jest.mock('../utils/modelCompatibility', () => ({
  ...jest.requireActual('../utils/modelCompatibility'),
  hasMemoryForWebSearch: () => true,
  isMemoryConstrained: () => false,
}));
const mockAddChat = jest.fn(async (_title: string, _modelId: number) => 9);
jest.mock('../store/chatStore', () => ({
  useChatStore: () => ({
    addChat: mockAddChat,
    updateLastUsed: jest.fn(),
    enableSource: jest.fn(),
  }),
}));
jest.mock('../store/sourceStore', () => ({
  useSourceStore: { getState: () => ({ sources: [{ id: 5 }] }) },
}));
const webEnabledByChat: Record<number, boolean> = {};
jest.mock('../store/webSearchStore', () => ({
  useWebSearchStore: {
    getState: () => ({
      isEnabled: (chatId: number) => !!webEnabledByChat[chatId],
      resetTrace: jest.fn(),
      transfer: jest.fn(),
      setSearchingWeb: jest.fn(),
      pushWebSearchEvent: jest.fn(),
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
    loadModel: jest.fn(async () => {}),
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
    loadModel: jest.Mock;
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
  waitForModelSwitch?: () => Promise<Model | undefined>
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
  state.loadModel.mockClear();
  state.model = { id: 1, modelName: 'Test LLM' };
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
      undefined,
      false
    );
  });

  it('sends normally when nothing is in flight', async () => {
    expect(await useSend(1)('hello')).toBe(true);
    expect(mockedState().interrupt).not.toHaveBeenCalled();
  });

  describe('regenerating the last answer', () => {
    it('re-asks the persisted question without a send motion or a new chat', async () => {
      const { checkIfChatExists } = jest.requireMock(
        '../database/chatRepository'
      ) as { checkIfChatExists: jest.Mock };
      const { persistImage } = jest.requireMock('../utils/persistImage') as {
        persistImage: jest.Mock;
      };
      const onMessageSent = messagesRef.current.onMessageSent as jest.Mock;
      onMessageSent.mockClear();
      checkIfChatExists.mockClear();
      persistImage.mockClear();

      expect(
        await useSend(7)(
          'Compare three capitals',
          'file://photo.jpg',
          undefined,
          {
            regenerate: true,
          }
        )
      ).toBe(true);

      expect(onMessageSent).not.toHaveBeenCalled();
      expect(checkIfChatExists).not.toHaveBeenCalled();
      expect(persistImage).not.toHaveBeenCalled();
      expect(mockAddChat).not.toHaveBeenCalled();
      expect(mockedState().sendChatMessage).toHaveBeenCalledWith(
        'Compare three capitals',
        7,
        expect.any(Function),
        expect.anything(),
        'file://photo.jpg',
        undefined,
        true
      );
    });
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
    const switched = new Promise<undefined>((resolve) => {
      settle = () => resolve(undefined);
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

describe('a send that lands inside the switch window', () => {
  const qwen = { id: 1, modelName: 'Qwen 3 - 0.6B' } as Model;
  const gemma = { id: 2, modelName: 'Gemma 4 - 2B' } as Model;
  const { checkIfChatExists } = jest.requireMock(
    '../database/chatRepository'
  ) as { checkIfChatExists: jest.Mock };

  const useSendDuringSwitchTo = (landedOn: Model | undefined) => {
    if (landedOn) mockedState().model = landedOn;
    return useSendChatMessage({
      chatId: 1,
      model: qwen,
      messageHistory: [],
      chatSettings: { systemPrompt: '', thinkingEnabled: false },
      enabledSources: [],
      vectorStore: null,
      embeddings: null,
      messagesRef,
      db: {} as SQLiteDatabase,
      isGenerating: false,
      isModelLoading: false,
      isSwitching: true,
      waitForModelSwitch: async () => landedOn,
    })('hello');
  };

  beforeEach(() => mockAddChat.mockClear());

  it('does not load the previous model back once the switch has landed', async () => {
    expect(await useSendDuringSwitchTo(gemma)).toBe(true);

    expect(mockedState().loadModel).not.toHaveBeenCalled();
    expect(mockedState().sendChatMessage).toHaveBeenCalled();
  });

  it('pins the new chat to the model the switch landed on', async () => {
    checkIfChatExists.mockResolvedValueOnce(false);

    await useSendDuringSwitchTo(gemma);

    expect(mockAddChat).toHaveBeenCalledWith(expect.any(String), gemma.id);
  });

  it('keeps the model the screen held when the switch did not land', async () => {
    checkIfChatExists.mockResolvedValueOnce(false);

    await useSendDuringSwitchTo(undefined);

    expect(mockedState().loadModel).not.toHaveBeenCalled();
    expect(mockAddChat).toHaveBeenCalledWith(expect.any(String), qwen.id);
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

describe('the model in the header is the one that answers', () => {
  const usePinnedTo = (model: Model) =>
    useSendChatMessage({
      chatId: 1,
      model,
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
      isSwitching: false,
    });

  it('loads the chat’s model before sending, so a new chat does not answer with the last one', async () => {
    const gemma = { id: 2, modelName: 'Gemma 4 - 2B' } as Model;

    expect(await usePinnedTo(gemma)('hello')).toBe(true);

    const state = mockedState();
    expect(state.loadModel).toHaveBeenCalledWith(gemma);
    expect(state.loadModel.mock.invocationCallOrder[0]).toBeLessThan(
      state.sendChatMessage.mock.invocationCallOrder[0]
    );
  });

  it('asks for no load when the chat’s model is already the resident one', async () => {
    const resident = { id: 1, modelName: 'Test LLM' } as Model;

    expect(await usePinnedTo(resident)('hello')).toBe(true);

    expect(mockedState().loadModel).not.toHaveBeenCalled();
  });

  it('loads nothing for a send it refuses', async () => {
    const state = mockedState();
    state.isGenerating = true;
    state.generatingForChatId = 1;

    expect(
      await usePinnedTo({ id: 2, modelName: 'Gemma 4 - 2B' } as Model)('hi')
    ).toBe('busy');
    expect(state.loadModel).not.toHaveBeenCalled();
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

describe('web search in a chat that has a document', () => {
  const useDocumentChatSend = () =>
    useSendChatMessage({
      chatId: 1,
      model: { id: 1, modelName: 'Test LLM' } as Model,
      messageHistory: [],
      chatSettings: { systemPrompt: '', thinkingEnabled: false },
      enabledSources: [5],
      vectorStore: {} as OPSQLiteVectorStore,
      embeddings: null,
      messagesRef,
      db: {} as SQLiteDatabase,
      isGenerating: false,
      isModelLoading: false,
      isSwitching: false,
    });

  const lastBuildSources = () => {
    const calls = mockedState().sendChatMessage.mock.calls;
    return calls[calls.length - 1][2] as () => Promise<unknown>;
  };

  beforeEach(() => {
    (runWebSearch as jest.Mock).mockReset();
    (runWebSearch as jest.Mock).mockResolvedValue({
      context: [],
      sourceDocuments: [],
      telemetry: { needsSearch: false },
    });
    webEnabledByChat[1] = true;
  });

  it('searches the web for a later message once the document is already in the chat', async () => {
    await useDocumentChatSend()('what is the weather in Kraków');

    await lastBuildSources()();

    expect(runWebSearch).toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalledWith(
      expect.objectContaining({ text1: WEB_SKIP_COPY.documents })
    );
  });

  it('keeps the web out of the message the document is attached to', async () => {
    await useDocumentChatSend()('summarise this', undefined, [
      { type: 'document', sourceId: 5, name: 'report.pdf' } as Attachment,
    ]);

    await lastBuildSources()();

    expect(runWebSearch).not.toHaveBeenCalled();
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: WEB_SKIP_COPY.documents })
    );
  });
});
