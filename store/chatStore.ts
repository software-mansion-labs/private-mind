import { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';
import {
  Chat,
  getAllChats,
  createChat,
  renameChat,
  deleteChat,
  setChatModel,
  ChatSettings,
  getChatSettings,
  getNextChatId,
  setChatSettings,
} from '../database/chatRepository';
import {
  activateSource,
  clearPhantomChat,
} from '../database/sourcesRepository';

interface ChatStore {
  chats: Chat[];
  db: SQLiteDatabase | null;
  phantomChat: Chat | null;
  setDB: (db: SQLiteDatabase) => void;
  loadChats: () => Promise<void>;
  updateLastUsed: (id: number) => void;
  getChatById: (id: number) => Chat | undefined;
  addChat: (title: string, modelId: number) => Promise<number | undefined>;
  renameChat: (id: number, newTitle: string) => Promise<void>;
  setChatModel: (id: number, modelId: number) => Promise<void>;
  deleteChat: (id: number) => Promise<void>;
  enableSource: (chatId: number, sourceId: number) => Promise<void>;
  initPhantomChat: (phantomChatId: number) => Promise<void>;
  setPhantomChatSettings: (settings: ChatSettings) => Promise<void>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  chats: [],
  db: null,
  phantomChat: null,

  setDB: (db) => {
    set({ db });
    get().loadChats();
  },

  loadChats: async () => {
    const db = get().db;
    if (!db) return;

    const chats = await getAllChats(db);
    set({
      chats,
    });
  },

  initPhantomChat: async (phantomChatId) => {
    const db = get().db;
    if (!db) return;
    await clearPhantomChat(db, phantomChatId);
    const defaultSettings = await getChatSettings(db, null);
    set({
      phantomChat: {
        id: phantomChatId,
        title: '',
        lastUsed: Date.now(),
        modelId: -1,
        enabledSources: [],
        settings: defaultSettings,
      },
    });
  },

  setPhantomChatSettings: async (newSettings) => {
    const db = get().db;
    if (!db) return;

    const phantomChat = get().phantomChat;
    if (phantomChat) {
      set({
        phantomChat: {
          ...phantomChat,
          settings: newSettings,
        },
      });
    }
  },

  updateLastUsed: (id: number) => {
    get().chats.forEach((chat) => {
      if (chat.id === id) {
        chat.lastUsed = Date.now();
      }
    });

    set((state) => ({
      chats: state.chats.sort((a, b) => b.lastUsed - a.lastUsed),
    }));
  },

  getChatById: (id: number) => {
    const chats = get().chats;

    return chats.find((chat) => chat.id === id);
  },

  addChat: async (title: string, modelId: number) => {
    const db = get().db;
    if (!db) return;
    const phantomChat = get().phantomChat;
    const newChatId = await createChat(db, title, modelId);
    if (newChatId === undefined) return;
    const enabledSources = phantomChat?.enabledSources || [];
    for (const enabledSource of enabledSources) {
      await activateSource(db, newChatId, enabledSource);
    }

    if (phantomChat?.settings) {
      await setChatSettings(db, newChatId, phantomChat?.settings);
    }

    set((state) => ({
      chats: [
        {
          id: newChatId,
          title: title,
          lastUsed: Date.now(),
          modelId: modelId,
          enabledSources: enabledSources,
        },
        ...state.chats,
      ],
      phantomChat: undefined,
    }));

    return newChatId;
  },

  renameChat: async (id: number, newTitle: string) => {
    const db = get().db;
    if (!db) return;

    await renameChat(db, id, newTitle);

    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === id ? { ...chat, title: newTitle } : chat
      ),
    }));
  },

  setChatModel: async (id: number, modelId: number) => {
    const db = get().db;
    if (!db) return;
    await setChatModel(db, id, modelId);
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === id ? { ...chat, model: modelId } : chat
      ),
    }));
  },

  deleteChat: async (id: number) => {
    const db = get().db;
    if (!db) return;

    await deleteChat(db, id);

    set((state) => ({
      chats: state.chats.filter((chat) => chat.id !== id),
    }));
  },

  enableSource: async (chatId: number, sourceId: number) => {
    const db = get().db;
    if (!db) return;
    const phantomChat = get().phantomChat;
    if (chatId === phantomChat?.id) {
      set({
        phantomChat: {
          ...phantomChat,
          enabledSources: [...(phantomChat.enabledSources || []), sourceId],
        },
      });

      return;
    }

    await activateSource(db, chatId, sourceId);

    set((state) => {
      const chat = state.chats.find((chat) => chat.id === chatId);
      if (chat) {
        chat.enabledSources = [...(chat.enabledSources || []), sourceId];
      }
      return { chats: [...state.chats] };
    });
  },
}));
