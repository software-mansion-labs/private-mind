import { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';
import {
  Chat,
  getAllChats,
  createChat,
  renameChat,
  deleteChat,
  setChatModel,
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
  initPhantomChat: (chatId: number) => Promise<void>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  chats: [],
  settings: {},
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

  initPhantomChat: async (chatId: number) => {
    const db = get().db;
    if (!db) return;

    await clearPhantomChat(db, chatId);

    set({
      phantomChat: {
        id: chatId,
        title: '',
        lastUsed: Date.now(),
        modelId: -1,
        enabledSources: [],
      },
    });
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

    const newChatId = await createChat(db, title, modelId);
    if (newChatId === undefined) return;
    const enabledSources = get().phantomChat?.enabledSources || [];
    for (const enabledSource of enabledSources) {
      await activateSource(db, newChatId, enabledSource);
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
