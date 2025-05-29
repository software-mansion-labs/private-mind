import { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';
import {
  Chat,
  getAllChats,
  createChat,
  renameChat,
  deleteChat,
} from '../database/chatRepository';

interface ChatStore {
  chats: Chat[];
  db: SQLiteDatabase | null;
  setDB: (db: SQLiteDatabase) => void;
  loadChats: () => Promise<void>;
  getChatById: (id: number) => Chat | undefined;
  addChat: (title: string) => Promise<number | undefined>;
  renameChat: (id: number, newTitle: string) => Promise<void>;
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
  getChatById: (id: number) => {
    const chats = get().chats;
    return chats.find((chat) => chat.id === id);
  },
  addChat: async (title: string) => {
    const db = get().db;
    if (!db) return;

    const newChatId = await createChat(db, title);

    set((state) => ({
      chats: [
        { id: newChatId, title: title, createdAt: Date.now() },
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
  deleteChat: async (id: number) => {
    const db = get().db;
    if (!db) return;

    await deleteChat(db, id);

    set((state) => ({
      chats: state.chats.filter((chat) => chat.id !== id),
    }));
  },
}));
