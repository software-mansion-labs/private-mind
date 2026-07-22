import {
  forkChat,
  getChatMessages,
  persistMessage,
} from '../database/chatRepository';
import type { SQLiteDatabase } from 'expo-sqlite';

type TransactionCallback = Parameters<
  SQLiteDatabase['withTransactionAsync']
>[0];

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

describe('forkChat', () => {
  it('creates a branch chat and copies messages up to the target message', async () => {
    const runAsync = jest
      .fn()
      .mockResolvedValueOnce({ lastInsertRowId: 10 })
      .mockResolvedValueOnce({ lastInsertRowId: 101 })
      .mockResolvedValueOnce({ lastInsertRowId: 102 })
      .mockResolvedValue({ lastInsertRowId: 0 });
    const getFirstAsync = jest.fn().mockResolvedValue({
      id: 1,
      title: 'Original',
      modelId: 7,
      lastUsed: 1,
    });
    const getAllAsync = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'one',
          timestamp: 100,
        },
        {
          id: 2,
          chatId: 1,
          role: 'assistant',
          content: 'two',
          timestamp: 200,
          modelName: 'model',
        },
        {
          id: 3,
          chatId: 1,
          role: 'user',
          content: 'three',
          timestamp: 300,
        },
      ])
      .mockResolvedValueOnce([]);
    const mockDb = {
      runAsync,
      getFirstAsync,
      getAllAsync,
      withTransactionAsync: async (callback: TransactionCallback) => callback(),
    } as SQLiteDatabase;

    const newChatId = await forkChat(mockDb, 1, 2);

    expect(newChatId).toBe(10);
    expect(runAsync).toHaveBeenCalledWith(
      `INSERT INTO chats (title, modelId, lastUsed) VALUES (?, ?, ?)`,
      ['Original', 7, expect.any(Number)]
    );
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO messages'),
      [10, 'user', 'one', 100, '', 0, 0, null, null]
    );
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO messages'),
      [10, 'assistant', 'two', 200, 'model', 0, 0, null, null]
    );
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO chatBranches'),
      [10, 102, 1, 2, 'Original', 'two']
    );
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO chatSettings'),
      [10, 1]
    );
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO chatSources'),
      [10, 1]
    );
  });

  it('throws when the target message is not in the original chat', async () => {
    const mockDb = {
      runAsync: jest.fn(),
      getFirstAsync: jest.fn().mockResolvedValue({
        id: 1,
        title: 'Original',
        modelId: 7,
        lastUsed: 1,
      }),
      getAllAsync: jest.fn().mockResolvedValueOnce([
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'one',
          timestamp: 100,
        },
      ]),
      withTransactionAsync: async (callback: TransactionCallback) => callback(),
    } as SQLiteDatabase;

    await expect(forkChat(mockDb, 1, 999)).rejects.toThrow(
      'Message 999 not found in chat 1'
    );
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it('preserves existing branch markers when forking from a branch', async () => {
    const runAsync = jest
      .fn()
      .mockResolvedValueOnce({ lastInsertRowId: 10 })
      .mockResolvedValueOnce({ lastInsertRowId: 101 })
      .mockResolvedValueOnce({ lastInsertRowId: 102 })
      .mockResolvedValueOnce({ lastInsertRowId: 103 })
      .mockResolvedValue({ lastInsertRowId: 0 });
    const mockDb = {
      runAsync,
      getFirstAsync: jest.fn().mockResolvedValue({
        id: 1,
        title: 'Fork 1',
        modelId: 7,
        lastUsed: 1,
      }),
      getAllAsync: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 1,
            chatId: 1,
            role: 'user',
            content: 'one',
            timestamp: 100,
          },
          {
            id: 2,
            chatId: 1,
            role: 'assistant',
            content: 'two',
            timestamp: 200,
          },
          {
            id: 3,
            chatId: 1,
            role: 'assistant',
            content: 'three',
            timestamp: 300,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 1,
            chatId: 1,
            afterMessageId: 2,
            sourceChatId: 8,
            sourceMessageId: 20,
            sourceChatTitle: 'Original',
            sourceMessagePreview: 'two',
            createdAt: 1,
          },
        ]),
      withTransactionAsync: async (callback: TransactionCallback) => callback(),
    } as SQLiteDatabase;

    await forkChat(mockDb, 1, 3);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO chatBranches'),
      [10, 102, 8, 20, 'Original', 'two']
    );
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO chatBranches'),
      [10, 103, 1, 3, 'Fork 1', 'three']
    );
  });

  it('replaces an existing branch marker at the target message with the latest branch marker', async () => {
    const runAsync = jest
      .fn()
      .mockResolvedValueOnce({ lastInsertRowId: 10 })
      .mockResolvedValueOnce({ lastInsertRowId: 101 })
      .mockResolvedValueOnce({ lastInsertRowId: 102 })
      .mockResolvedValue({ lastInsertRowId: 0 });
    const mockDb = {
      runAsync,
      getFirstAsync: jest.fn().mockResolvedValue({
        id: 1,
        title: 'Fork 1',
        modelId: 7,
        lastUsed: 1,
      }),
      getAllAsync: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 1,
            chatId: 1,
            role: 'user',
            content: 'one',
            timestamp: 100,
          },
          {
            id: 2,
            chatId: 1,
            role: 'assistant',
            content: 'two',
            timestamp: 200,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 1,
            chatId: 1,
            afterMessageId: 2,
            sourceChatId: 8,
            sourceMessageId: 20,
            sourceChatTitle: 'Original',
            sourceMessagePreview: 'old marker',
            createdAt: 1,
          },
        ]),
      withTransactionAsync: async (callback: TransactionCallback) => callback(),
    } as SQLiteDatabase;

    await forkChat(mockDb, 1, 2);

    expect(runAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO chatBranches'),
      [10, 102, 8, 20, 'Original', 'old marker']
    );
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO chatBranches'),
      [10, 102, 1, 2, 'Fork 1', 'two']
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
