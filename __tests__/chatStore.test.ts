import { useChatStore } from '../store/chatStore';
import * as chatRepository from '../database/chatRepository';
import * as sourcesRepository from '../database/sourcesRepository';

// Mock all DB interactions
jest.mock('../database/chatRepository');
jest.mock('../database/sourcesRepository');

const mockDb = {} as any;

const mockChat = (id: number, lastUsed = Date.now()) => ({
  id,
  title: `Chat ${id}`,
  modelId: 1,
  lastUsed,
  enabledSources: [],
});

beforeEach(() => {
  useChatStore.setState({
    chats: [],
    db: mockDb,
    phantomChat: null,
  });
  jest.clearAllMocks();
});

describe('getChatById', () => {
  it('returns the correct chat', () => {
    useChatStore.setState({ chats: [mockChat(1), mockChat(2), mockChat(3)] });
    const chat = useChatStore.getState().getChatById(2);
    expect(chat?.id).toBe(2);
  });

  it('returns undefined for unknown id', () => {
    useChatStore.setState({ chats: [mockChat(1)] });
    expect(useChatStore.getState().getChatById(999)).toBeUndefined();
  });
});

describe('updateLastUsed', () => {
  it('re-sorts chats so the updated one is first', () => {
    const now = Date.now();
    useChatStore.setState({
      chats: [
        mockChat(1, now - 3000),
        mockChat(2, now - 2000),
        mockChat(3, now - 1000),
      ],
    });

    useChatStore.getState().updateLastUsed(1);

    const chats = useChatStore.getState().chats;
    expect(chats[0].id).toBe(1);
  });

  it('does not crash for unknown id', () => {
    useChatStore.setState({ chats: [mockChat(1)] });
    expect(() => useChatStore.getState().updateLastUsed(999)).not.toThrow();
  });
});

describe('deleteChat', () => {
  it('removes the chat from state', async () => {
    (chatRepository.deleteChat as jest.Mock).mockResolvedValue(undefined);
    useChatStore.setState({ chats: [mockChat(1), mockChat(2)] });

    await useChatStore.getState().deleteChat(1);

    const chats = useChatStore.getState().chats;
    expect(chats).toHaveLength(1);
    expect(chats[0].id).toBe(2);
  });
});

describe('renameChat', () => {
  it('updates the title in state', async () => {
    (chatRepository.renameChat as jest.Mock).mockResolvedValue(undefined);
    useChatStore.setState({ chats: [mockChat(1)] });

    await useChatStore.getState().renameChat(1, 'New Title');

    expect(useChatStore.getState().chats[0].title).toBe('New Title');
  });

  it('does not change other chats', async () => {
    (chatRepository.renameChat as jest.Mock).mockResolvedValue(undefined);
    useChatStore.setState({ chats: [mockChat(1), mockChat(2)] });

    await useChatStore.getState().renameChat(1, 'Changed');

    expect(useChatStore.getState().chats[1].title).toBe('Chat 2');
  });
});

describe('addChat', () => {
  it('prepends the new chat to state', async () => {
    (chatRepository.createChat as jest.Mock).mockResolvedValue(42);
    useChatStore.setState({ chats: [mockChat(1)], phantomChat: null });

    const id = await useChatStore.getState().addChat('My Chat', 5);

    expect(id).toBe(42);
    const chats = useChatStore.getState().chats;
    expect(chats[0].id).toBe(42);
    expect(chats[0].title).toBe('My Chat');
    expect(chats[0].modelId).toBe(5);
  });

  it('copies phantom chat sources to the new chat', async () => {
    (chatRepository.createChat as jest.Mock).mockResolvedValue(10);
    (sourcesRepository.activateSource as jest.Mock).mockResolvedValue(undefined);
    useChatStore.setState({
      chats: [],
      phantomChat: {
        id: -1,
        title: '',
        modelId: -1,
        lastUsed: 0,
        enabledSources: [3, 7],
      },
    });

    await useChatStore.getState().addChat('Chat', 1);

    expect(sourcesRepository.activateSource).toHaveBeenCalledTimes(2);
    expect(sourcesRepository.activateSource).toHaveBeenCalledWith(mockDb, 10, 3);
    expect(sourcesRepository.activateSource).toHaveBeenCalledWith(mockDb, 10, 7);
  });

  it('clears phantomChat after adding', async () => {
    (chatRepository.createChat as jest.Mock).mockResolvedValue(1);
    useChatStore.setState({
      phantomChat: { id: -1, title: '', modelId: -1, lastUsed: 0, enabledSources: [] },
    });

    await useChatStore.getState().addChat('Chat', 1);

    expect(useChatStore.getState().phantomChat).toBeFalsy();
  });

  it('returns undefined and does not add chat when db is not set', async () => {
    useChatStore.setState({ db: null, chats: [] });

    const id = await useChatStore.getState().addChat('Chat', 1);

    expect(id).toBeUndefined();
    expect(useChatStore.getState().chats).toHaveLength(0);
  });
});

describe('setChatModel', () => {
  it('updates modelId on the correct chat', async () => {
    (chatRepository.setChatModel as jest.Mock).mockResolvedValue(undefined);
    useChatStore.setState({ chats: [mockChat(1), mockChat(2)] });

    await useChatStore.getState().setChatModel(1, 99);

    const updated = useChatStore.getState().chats.find((c) => c.id === 1);
    expect(updated?.modelId).toBe(99);
  });

  it('does not affect other chats', async () => {
    (chatRepository.setChatModel as jest.Mock).mockResolvedValue(undefined);
    useChatStore.setState({ chats: [mockChat(1), mockChat(2)] });

    await useChatStore.getState().setChatModel(1, 99);

    const other = useChatStore.getState().chats.find((c) => c.id === 2);
    expect(other?.modelId).toBe(1); // original modelId from mockChat
  });
});

describe('enableSource', () => {
  it('adds sourceId to phantomChat without hitting the db', async () => {
    useChatStore.setState({
      phantomChat: { id: 99, title: '', modelId: -1, lastUsed: 0, enabledSources: [1] },
    });

    await useChatStore.getState().enableSource(99, 5);

    expect(useChatStore.getState().phantomChat?.enabledSources).toEqual([1, 5]);
    expect(sourcesRepository.activateSource).not.toHaveBeenCalled();
  });

  it('calls activateSource and updates state for a real chat', async () => {
    (sourcesRepository.activateSource as jest.Mock).mockResolvedValue(undefined);
    useChatStore.setState({
      chats: [{ ...mockChat(1), enabledSources: [2] }],
      phantomChat: null,
    });

    await useChatStore.getState().enableSource(1, 7);

    expect(sourcesRepository.activateSource).toHaveBeenCalledWith(mockDb, 1, 7);
    expect(useChatStore.getState().chats[0].enabledSources).toEqual([2, 7]);
  });
});

describe('setPhantomChatSettings', () => {
  it('updates settings on phantomChat', async () => {
    useChatStore.setState({
      phantomChat: { id: -1, title: '', modelId: -1, lastUsed: 0, enabledSources: [] },
    });
    const newSettings = { systemPrompt: 'Be concise.', contextWindow: 5 };

    await useChatStore.getState().setPhantomChatSettings(newSettings);

    expect(useChatStore.getState().phantomChat?.settings).toEqual(newSettings);
  });

  it('does nothing when phantomChat is null', async () => {
    useChatStore.setState({ phantomChat: null });
    await expect(
      useChatStore.getState().setPhantomChatSettings({ systemPrompt: 'x', contextWindow: 1 })
    ).resolves.not.toThrow();
  });
});

describe('initPhantomChat with model system prompt', () => {
  it('uses model systemPrompt when available', async () => {
    const modelPrompt = 'Polish system prompt';
    (chatRepository.getChatSettings as jest.Mock).mockResolvedValue({
      systemPrompt: 'global default',
      contextWindow: 6,
    });

    await useChatStore.getState().initPhantomChat(99, { systemPrompt: modelPrompt } as any);

    const phantom = useChatStore.getState().phantomChat;
    expect(phantom?.settings?.systemPrompt).toBe(modelPrompt);
  });

  it('falls back to global default when model systemPrompt is null', async () => {
    (chatRepository.getChatSettings as jest.Mock).mockResolvedValue({
      systemPrompt: 'global default',
      contextWindow: 6,
    });

    await useChatStore.getState().initPhantomChat(99, { systemPrompt: null } as any);

    const phantom = useChatStore.getState().phantomChat;
    expect(phantom?.settings?.systemPrompt).toBe('global default');
  });

  it('falls back to global default when no model provided', async () => {
    (chatRepository.getChatSettings as jest.Mock).mockResolvedValue({
      systemPrompt: 'global default',
      contextWindow: 6,
    });

    await useChatStore.getState().initPhantomChat(99);

    const phantom = useChatStore.getState().phantomChat;
    expect(phantom?.settings?.systemPrompt).toBe('global default');
  });
});
