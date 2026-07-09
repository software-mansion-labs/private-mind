import AsyncStorage from '@react-native-async-storage/async-storage';
import { SQLiteDatabase } from 'expo-sqlite';

const DEFAULT_CHAT_SETTINGS_KEY = 'default_chat_settings';

const readDefaultChatSettings = async (): Promise<ChatSettings | null> => {
  const raw = await AsyncStorage.getItem(DEFAULT_CHAT_SETTINGS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const settings = parsed as Partial<ChatSettings>;
    if (typeof settings.systemPrompt !== 'string') return null;
    return {
      systemPrompt: settings.systemPrompt,
      thinkingEnabled: settings.thinkingEnabled,
    };
  } catch {
    return null;
  }
};

export type Chat = {
  id: number;
  modelId: number;
  title: string;
  lastUsed: number;
  enabledSources?: number[];
  settings?: ChatSettings;
};

export type ChatSettings = {
  systemPrompt: string;
  thinkingEnabled?: boolean;
};

export type Message = {
  id: number;
  chatId: number;
  modelName?: string;
  role: 'user' | 'assistant' | 'system' | 'event';
  content: string;
  imagePath?: string;
  documentName?: string;
  tokensPerSecond?: number;
  timeToFirstToken?: number;
  timestamp: number;
};

export const createChat = async (
  db: SQLiteDatabase,
  title: string,
  modelId: number,
  modelSystemPrompt?: string | null
): Promise<number | void> => {
  try {
    const result = await db.runAsync(
      `INSERT INTO chats (title, modelId) VALUES (?, ?)`,
      [title, modelId]
    );

    if (result.lastInsertRowId) {
      const defaultSettings = await readDefaultChatSettings();
      if (defaultSettings) {
        await setChatSettings(db, result.lastInsertRowId, {
          systemPrompt: modelSystemPrompt ?? defaultSettings.systemPrompt,
        });
      }
    }

    return result.lastInsertRowId;
  } catch (error) {
    console.error('Error creating chat:', error);
  }
};

export const getAllChats = async (db: SQLiteDatabase): Promise<Chat[]> => {
  const chats = await db.getAllAsync<Chat & { enabledSources: string | null }>(
    `SELECT c.*, 
            GROUP_CONCAT(cs.sourceId) as enabledSources
     FROM chats c
     LEFT JOIN chatSources cs ON c.id = cs.chatId
     GROUP BY c.id
     ORDER BY c.id DESC`
  );

  return chats.map((chat) => ({
    ...chat,
    enabledSources: chat.enabledSources
      ? chat.enabledSources.split(',').map((id) => parseInt(id, 10))
      : [],
  }));
};

export const getChatMessages = async (
  db: SQLiteDatabase,
  chatId: number
): Promise<Message[]> => {
  return db.getAllAsync<Message>(
    `SELECT * FROM messages WHERE chatId = ? ORDER BY id ASC`,
    [chatId]
  );
};

export const persistMessage = async (
  db: SQLiteDatabase,
  message: Omit<Message, 'id' | 'timestamp'>
): Promise<number> => {
  const result = await db.runAsync(
    `INSERT INTO messages (chatId, role, content, modelName, tokensPerSecond, timeToFirstToken, imagePath, documentName) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      message.chatId,
      message.role,
      message.content,
      message.modelName || '',
      message.tokensPerSecond ?? 0,
      message.timeToFirstToken ?? 0,
      message.imagePath || null,
      message.documentName || null,
    ]
  );

  //If the message is event type, we don't update the lastUsed timestamp so the chat won't be elevated on the chat list
  if (message.role !== 'event') {
    const timestamp = Date.now();
    await db.runAsync(`UPDATE chats SET lastUsed = ? WHERE id = ?`, [
      timestamp,
      message.chatId,
    ]);
  }

  return result.lastInsertRowId;
};

// SQLite's default SQLITE_MAX_VARIABLE_NUMBER is 999 on older builds.
// 9 params per row, so 100 rows per batch keeps us well under the limit.
const IMPORT_BATCH_SIZE = 100;

export const importMessages = async (
  db: SQLiteDatabase,
  chatId: number,
  messages: Message[]
): Promise<void> => {
  if (messages.length === 0) return;

  for (let i = 0; i < messages.length; i += IMPORT_BATCH_SIZE) {
    const batch = messages.slice(i, i + IMPORT_BATCH_SIZE);
    const placeholders = batch
      .map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .join(', ');
    const flattenedValues = batch.flatMap((msg) => [
      chatId,
      msg.role,
      msg.content,
      msg.timestamp ?? Date.now(),
      msg.modelName ?? '',
      msg.tokensPerSecond ?? 0,
      msg.timeToFirstToken ?? 0,
      msg.imagePath ?? null,
      msg.documentName ?? null,
    ]);
    await db.runAsync(
      `INSERT INTO messages (chatId, role, content, timestamp, modelName, tokensPerSecond, timeToFirstToken, imagePath, documentName) VALUES ${placeholders}`,
      flattenedValues
    );
  }
};

export const deleteChat = async (
  db: SQLiteDatabase,
  chatId: number
): Promise<void> => {
  await db.runAsync(`DELETE FROM chats WHERE id = ?;`, [chatId]);
};

export const getChatSettings = async (
  db: SQLiteDatabase,
  chatId: number | null
): Promise<ChatSettings> => {
  const result = await db.getFirstAsync<{
    systemPrompt: string;
    thinkingEnabled: number | null;
  }>(
    'SELECT systemPrompt, thinkingEnabled FROM chatSettings WHERE chatId = ?',
    [chatId]
  );

  if (!result) {
    const defaultSettings = await readDefaultChatSettings();
    if (defaultSettings) {
      return defaultSettings;
    }
  }

  return result
    ? {
        systemPrompt: result.systemPrompt,
        thinkingEnabled:
          result.thinkingEnabled === 1
            ? true
            : result.thinkingEnabled === 0
              ? false
              : undefined,
      }
    : {
        systemPrompt: '',
      };
};

export const setChatSettings = async (
  db: SQLiteDatabase,
  chatId: number | null,
  settings: ChatSettings
): Promise<void> => {
  if (chatId === null) {
    await AsyncStorage.setItem(
      DEFAULT_CHAT_SETTINGS_KEY,
      JSON.stringify(settings)
    );
  } else {
    const thinkingValue =
      settings.thinkingEnabled === undefined
        ? null
        : settings.thinkingEnabled
          ? 1
          : 0;

    await db.runAsync(
      `
    INSERT INTO chatSettings (chatId, systemPrompt, thinkingEnabled)
    VALUES (?, ?, ?)
    ON CONFLICT(chatId) DO UPDATE SET
      systemPrompt = excluded.systemPrompt,
      thinkingEnabled = excluded.thinkingEnabled
  `,
      [chatId, settings.systemPrompt, thinkingValue]
    );
  }
};

export const renameChat = async (
  db: SQLiteDatabase,
  id: number,
  newTitle: string
) => {
  await db.runAsync(`UPDATE chats SET title = ? WHERE id = ?`, [newTitle, id]);

  return;
};

export const setChatModel = async (
  db: SQLiteDatabase,
  id: number,
  model: number
) => {
  await db.runAsync(`UPDATE chats SET modelId = ? WHERE id = ?`, [model, id]);
  return;
};

export const getNextChatId = async (db: SQLiteDatabase): Promise<number> => {
  const result = await db.getFirstAsync<{ seq: number }>(
    `SELECT seq FROM sqlite_sequence WHERE name = 'chats'`
  );
  return (result?.seq ?? 0) + 1;
};

export const checkIfChatExists = async (
  db: SQLiteDatabase,
  chatId: number
): Promise<boolean> => {
  const result = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM chats WHERE id = ?`,
    [chatId]
  );
  return !!result;
};
