import { SQLiteDatabase } from 'expo-sqlite';
import { Message, persistMessage } from './chatRepository';

export interface Source {
  id: number;
  name: string;
  type: string;
  size: number | null;
}

export const insertSource = async (
  db: SQLiteDatabase,
  source: Omit<Source, 'id'>
): Promise<number> => {
  const result = await db.runAsync(
    `INSERT INTO sources (
      name,
      type,
      size
    ) VALUES (?, ?, ?)`,
    [source.name, source.type, source.size]
  );

  return result.lastInsertRowId!;
};

export const deleteSource = async (db: SQLiteDatabase, id: number) => {
  await db.runAsync(`DELETE FROM sources WHERE id = ?`, [id]);
};

export const renameSource = async (
  db: SQLiteDatabase,
  id: number,
  newName: string
) => {
  await db.runAsync(`UPDATE sources SET name = ? WHERE id = ?`, [newName, id]);
};

export const getAllSources = async (db: SQLiteDatabase) => {
  const result = await db.getAllAsync<Source>(`SELECT * FROM sources`);
  return result;
};

export const getSourcesEnabledInChat = async (
  db: SQLiteDatabase,
  chatId: number
) => {
  const result = await db.getAllAsync<{ chatId: number; sourceId: number }>(
    `SELECT * FROM chatSources WHERE chatId = ?`,
    [chatId]
  );

  return result.map((item) => item.sourceId);
};

export const deactivateSource = async (
  db: SQLiteDatabase,
  chatId: number,
  sourceId: number
) => {
  await db.runAsync(
    `DELETE FROM chatSources WHERE chatId = ? AND sourceId = ?`,
    [chatId, sourceId]
  );
};

export const activateSource = async (
  db: SQLiteDatabase,
  chatId: number,
  sourceId: number
) => {
  await db.runAsync(
    `INSERT INTO chatSources (chatId, sourceId) VALUES (?, ?)`,
    [chatId, sourceId]
  );
};

export const deleteSourceFromChats = async (
  db: SQLiteDatabase,
  source: Source
) => {
  const chats = await db.getAllAsync<{ chatId: number }>(
    `SELECT chatId FROM chatSources WHERE sourceId = ?`,
    [source.id]
  );

  const content = `${source.name} has been deleted and this chat can no longer use it as a source file`;

  const eventMessage = {
    role: 'event',
    content: content,
    timestamp: Date.now(),
  };

  await Promise.all(
    chats.map(async (chat) => {
      await persistMessage(db, { ...eventMessage, chatId: chat.chatId } as Omit<
        Message,
        'id'
      >);
    })
  );

  await db.runAsync(`DELETE FROM chatSources WHERE sourceId = ?`, [source.id]);
};

export const clearPhantomChat = async (db: SQLiteDatabase, chatId: number) => {
  await db.runAsync(`DELETE FROM messages WHERE chatId = ?`, [chatId]);
};
