import { getChatMessages, persistMessage } from '../database/chatRepository';
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

describe('getChatMessages source provenance', () => {
  it('preserves web kind/url so reloaded web results are not read as documents', async () => {
    const webSource = {
      name: 'React Native Reanimated',
      url: 'https://docs.swmansion.com/react-native-reanimated/',
      passage: 'smooth animations on the UI thread',
      kind: 'web',
    };
    const getAllAsync = jest.fn().mockResolvedValue([
      {
        id: 1,
        chatId: 1,
        role: 'assistant',
        content: 'Reanimated runs animations on the UI thread.',
        sourceDocuments: JSON.stringify([webSource]),
      },
    ]);
    const mockDb = { getAllAsync } as Partial<SQLiteDatabase> as SQLiteDatabase;

    const messages = await getChatMessages(mockDb, 1);

    expect(messages[0].sourceDocuments?.[0]).toMatchObject({
      kind: 'web',
      url: 'https://docs.swmansion.com/react-native-reanimated/',
      name: 'React Native Reanimated',
    });
  });

  it('leaves document sources without a web kind/url', async () => {
    const getAllAsync = jest.fn().mockResolvedValue([
      {
        id: 2,
        chatId: 1,
        role: 'assistant',
        content: 'From the report.',
        sourceDocuments: JSON.stringify([
          { documentId: 7, name: 'report.pdf', passage: 'Revenue up.' },
        ]),
      },
    ]);
    const mockDb = { getAllAsync } as Partial<SQLiteDatabase> as SQLiteDatabase;

    const messages = await getChatMessages(mockDb, 1);
    const source = messages[0].sourceDocuments?.[0];

    expect(source?.name).toBe('report.pdf');
    expect(source?.kind).toBeUndefined();
    expect(source?.url).toBeUndefined();
  });
});
