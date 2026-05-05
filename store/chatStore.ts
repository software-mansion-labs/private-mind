import { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';
import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import { Model } from '../database/modelRepository';
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
import { maybePromptReview } from '../utils/reviewPrompt';

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
  deleteChat: (id: number, vectorStore?: OPSQLiteVectorStore) => Promise<void>;
  enableSource: (chatId: number, sourceId: number) => Promise<void>;
  initPhantomChat: (phantomChatId: number, model?: Model) => Promise<void>;
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

  initPhantomChat: async (phantomChatId, model) => {
    const db = get().db;
    if (!db) return;
    const [, defaultSettings] = await Promise.all([
      clearPhantomChat(db, phantomChatId),
      getChatSettings(db, null),
    ]);

    // Use model-specific system prompt if available, otherwise global default
    const systemPrompt = model?.systemPrompt ?? defaultSettings.systemPrompt;

    set({
      phantomChat: {
        id: phantomChatId,
        title: '',
        lastUsed: Date.now(),
        modelId: -1,
        enabledSources: [],
        settings: {
          ...defaultSettings,
          systemPrompt,
        },
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
    const now = Date.now();
    set((state) => ({
      chats: state.chats
        .map((chat) => (chat.id === id ? { ...chat, lastUsed: now } : chat))
        .sort((a, b) => b.lastUsed - a.lastUsed),
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
      phantomChat: null,
    }));

    maybePromptReview();

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
        chat.id === id ? { ...chat, modelId } : chat
      ),
    }));
  },

  deleteChat: async (id: number, vectorStore?: OPSQLiteVectorStore) => {
    const db = get().db;
    if (!db) return;

    await deleteChat(db, id);

    set((state) => ({
      chats: state.chats.filter((chat) => chat.id !== id),
    }));

    if (vectorStore) {
      // Lazy import to avoid circular dependency / transitive ESM issues in tests
      const { useSourceStore } = require('./sourceStore');
      await useSourceStore.getState().cleanupOrphanedSources(vectorStore);
    }
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

    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              enabledSources: [...(chat.enabledSources || []), sourceId],
            }
          : chat
      ),
    }));
  },
}));
