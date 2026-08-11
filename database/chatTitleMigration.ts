import type { SQLiteDatabase } from 'expo-sqlite';
import { toChatTitle } from '../utils/chatLabel';

const LEGACY_TITLE_LIMIT = 25;
const LEGACY_MARKER = '...';

export const restoreTruncatedChatTitles = async (
  db: SQLiteDatabase
): Promise<number> => {
  const candidates = await db.getAllAsync<{ id: number; title: string }>(
    `SELECT id, title FROM chats WHERE title LIKE '%...' AND length(title) = ?`,
    LEGACY_TITLE_LIMIT + LEGACY_MARKER.length
  );

  let restored = 0;

  for (const chat of candidates) {
    const stub = chat.title.slice(0, -LEGACY_MARKER.length);
    const firstMessage = await db.getFirstAsync<{
      content: string | null;
      documentName: string | null;
    }>(
      `SELECT content, documentName FROM messages
       WHERE chatId = ? AND role = 'user'
       ORDER BY id ASC LIMIT 1`,
      chat.id
    );
    if (!firstMessage) continue;

    const source = [
      firstMessage.content?.trim(),
      firstMessage.documentName,
    ].find((candidate) => candidate?.slice(0, LEGACY_TITLE_LIMIT) === stub);
    if (!source) continue;

    const title = toChatTitle(source);
    if (title === chat.title) continue;

    await db.runAsync(
      `UPDATE chats SET title = ? WHERE id = ?`,
      title,
      chat.id
    );
    restored += 1;
  }

  return restored;
};
