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

interface ChatStore {
  chats: Chat[];
  db: SQLiteDatabase | null;
  setDB: (db: SQLiteDatabase) => void;
  loadChats: () => Promise<void>;
  updateLastUsed: (id: number) => void;
  getChatById: (id: number) => Chat | undefined;
  addChat: (title: string, model: number) => Promise<number | undefined>;
  renameChat: (id: number, newTitle: string) => Promise<void>;
  setChatModel: (id: number, model: number) => Promise<void>;
  deleteChat: (id: number) => Promise<void>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  chats: [],
  settings: {},
  db: null,
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
  addChat: async (title: string, model: number) => {
    const db = get().db;
    if (!db) return;

    const newChatId = await createChat(db, title, model);

    set((state) => ({
      chats: [
        { id: newChatId, title: title, lastUsed: Date.now(), model: model },
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
  setChatModel: async (id: number, model: number) => {
    const db = get().db;
    if (!db) return;
    await setChatModel(db, id, model);

    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === id ? { ...chat, model: model } : chat
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
}));
