import { persistMessage } from '../database/chatRepository';
import type { SQLiteDatabase } from 'expo-sqlite';

jest.mock('expo-sqlite', () => ({
  useSQLiteContext: jest.fn(() => ({})),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
}));

describe('persistMessage with imagePath', () => {
  it('includes imagePath in INSERT when provided', async () => {
    const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 1 });
    const mockDb = { runAsync } as Partial<SQLiteDatabase> as SQLiteDatabase;

    await persistMessage(mockDb, {
      role: 'user',
      content: 'Look at this',
      chatId: 1,
      imagePath: '/path/to/image.jpg',
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('imagePath'),
      expect.arrayContaining(['/path/to/image.jpg'])
    );
  });

  it('passes null imagePath when not provided', async () => {
    const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 2 });
    const mockDb = { runAsync } as Partial<SQLiteDatabase> as SQLiteDatabase;

    await persistMessage(mockDb, {
      role: 'user',
      content: 'Hello',
      chatId: 1,
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('imagePath'),
      expect.arrayContaining([null])
    );
  });

  it('serializes sourceDocuments when provided', async () => {
    const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 3 });
    const mockDb = { runAsync } as Partial<SQLiteDatabase> as SQLiteDatabase;
    const sourceDocuments = [
      {
        documentId: 7,
        name: 'financial_report.pdf',
        passage: 'Revenue increased.',
        similarity: 0.82,
      },
    ];

    await persistMessage(mockDb, {
      role: 'assistant',
      content: 'Revenue increased.',
      chatId: 1,
      sourceDocuments,
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('sourceDocuments'),
      expect.arrayContaining([JSON.stringify(sourceDocuments)])
    );
  });
});
