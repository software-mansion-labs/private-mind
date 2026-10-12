import {
  forkChat,
  getChatDigest,
  getChatMessages,
  persistMessage,
  setChatDigest,
} from '../database/chatRepository';
import type { SourceDocument } from '../database/chatRepository';
import type { SQLiteDatabase } from 'expo-sqlite';
import { attributeSourcesByBlock } from '../utils/attributeSources';

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

describe('getChatDigest / setChatDigest', () => {
  it('upserts the digest by chatId', async () => {
    const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 1 });
    const mockDb = { runAsync } as Partial<SQLiteDatabase> as SQLiteDatabase;

    await setChatDigest(mockDb, 5, 'Discussing Qwen 3 vs Gemma 4 benchmarks.');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT(chatId)'),
      [5, 'Discussing Qwen 3 vs Gemma 4 benchmarks.']
    );
  });

  it('returns null when no digest row exists yet', async () => {
    const getFirstAsync = jest.fn().mockResolvedValue(null);
    const mockDb = {
      getFirstAsync,
    } as Partial<SQLiteDatabase> as SQLiteDatabase;

    expect(await getChatDigest(mockDb, 5)).toBeNull();
  });

  it('returns the stored digest text', async () => {
    const getFirstAsync = jest.fn().mockResolvedValue({ digest: 'Summary.' });
    const mockDb = {
      getFirstAsync,
    } as Partial<SQLiteDatabase> as SQLiteDatabase;

    expect(await getChatDigest(mockDb, 5)).toBe('Summary.');
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
    } as unknown as SQLiteDatabase;

    const newChatId = await forkChat(mockDb, 1, 2);

    expect(newChatId).toBe(10);
    expect(runAsync).toHaveBeenCalledWith(
      `INSERT INTO chats (title, modelId, lastUsed) VALUES (?, ?, ?)`,
      ['Original', 7, expect.any(Number)]
    );
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO messages'),
      [10, 'user', 'one', 100, '', 0, 0, null, null, null, null, 0]
    );
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO messages'),
      [10, 'assistant', 'two', 200, 'model', 0, 0, null, null, null, null, 0]
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

  it('carries the stopped mark of a truncated answer into the fork', async () => {
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
        { id: 1, chatId: 1, role: 'user', content: 'one', timestamp: 100 },
        {
          id: 2,
          chatId: 1,
          role: 'assistant',
          content: 'two',
          timestamp: 200,
          modelName: 'model',
          stoppedByUser: 1,
        },
      ])
      .mockResolvedValueOnce([]);
    const mockDb = {
      runAsync,
      getFirstAsync,
      getAllAsync,
      withTransactionAsync: async (callback: TransactionCallback) => callback(),
    } as unknown as SQLiteDatabase;

    await forkChat(mockDb, 1, 2);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('stoppedByUser'),
      [10, 'assistant', 'two', 200, 'model', 0, 0, null, null, null, null, 1]
    );
  });

  it('copies the sourceDocuments of a grounded message into the fork', async () => {
    const sourceDocuments = [
      { kind: 'web' as const, name: 'Example', url: 'https://example.com' },
    ];
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
        title: 'Original',
        modelId: 7,
        lastUsed: 1,
      }),
      getAllAsync: jest
        .fn()
        .mockResolvedValueOnce([
          { id: 1, chatId: 1, role: 'user', content: 'q', timestamp: 100 },
          {
            id: 2,
            chatId: 1,
            role: 'assistant',
            content: 'a',
            timestamp: 200,
            modelName: 'model',
            sourceDocuments: JSON.stringify(sourceDocuments),
          },
        ])
        .mockResolvedValueOnce([]),
      withTransactionAsync: async (callback: TransactionCallback) => callback(),
    } as unknown as SQLiteDatabase;

    await forkChat(mockDb, 1, 2);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('sourceDocuments'),
      expect.arrayContaining([expect.stringContaining('https://example.com')])
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
    } as unknown as SQLiteDatabase;

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
    } as unknown as SQLiteDatabase;

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
    } as unknown as SQLiteDatabase;

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

  it('keeps a source the answer did not use marked as unused after a reload', async () => {
    const getAllAsync = jest.fn().mockResolvedValue([
      {
        id: 4,
        chatId: 1,
        role: 'assistant',
        content: 'RTX 5080 kosztuje 5 199 zł.',
        sourceDocuments: JSON.stringify([
          { name: 'x-kom', url: 'https://x-kom.pl/a', kind: 'web', used: true },
          {
            name: 'Morele',
            url: 'https://morele.net/b',
            kind: 'web',
            used: false,
          },
          { name: 'Ceneo', url: 'https://ceneo.pl/c', kind: 'web' },
        ]),
      },
    ]);
    const mockDb = { getAllAsync } as Partial<SQLiteDatabase> as SQLiteDatabase;

    const messages = await getChatMessages(mockDb, 1);

    expect(messages[0].sourceDocuments?.map((source) => source.used)).toEqual([
      true,
      false,
      undefined,
    ]);
  });

  it('drops a stored url that is not an http page, so a tap cannot fire another app', async () => {
    const getAllAsync = jest.fn().mockResolvedValue([
      {
        id: 4,
        chatId: 1,
        role: 'assistant',
        content: 'Answer.',
        sourceDocuments: JSON.stringify([
          { name: 'Real', url: 'https://example.com/a', kind: 'web' },
          { name: 'Script', url: 'javascript:alert(1)', kind: 'web' },
          {
            name: 'Intent',
            url: 'intent://scan/#Intent;scheme=zxing;end',
            kind: 'web',
          },
          { name: 'File', url: 'file:///etc/passwd', kind: 'web' },
        ]),
      },
    ]);
    const mockDb = { getAllAsync } as Partial<SQLiteDatabase> as SQLiteDatabase;

    const messages = await getChatMessages(mockDb, 1);

    expect(messages[0].sourceDocuments?.map((source) => source.url)).toEqual([
      'https://example.com/a',
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('keeps the query that found each web source, so the saved trace can replay the searches', async () => {
    const getAllAsync = jest.fn().mockResolvedValue([
      {
        id: 3,
        chatId: 1,
        role: 'assistant',
        content: 'Bitcoin kosztuje 98 000 USD.',
        sourceDocuments: JSON.stringify([
          {
            name: 'Bankier',
            url: 'https://bankier.pl/btc',
            kind: 'web',
            query: 'porównaj kurs bitcoina i ethereum',
            sourceQuery: 'kurs bitcoin',
          },
        ]),
      },
    ]);
    const mockDb = { getAllAsync } as Partial<SQLiteDatabase> as SQLiteDatabase;

    const messages = await getChatMessages(mockDb, 1);

    expect(messages[0].sourceDocuments?.[0]).toMatchObject({
      query: 'porównaj kurs bitcoina i ethereum',
      sourceQuery: 'kurs bitcoin',
    });
  });

  it('carries every field a source has, because the reader lists them one by one', async () => {
    const everyField: Required<SourceDocument> = {
      documentId: 7,
      name: 'Bankier',
      passage: 'Bitcoin kosztuje 98 000 USD.',
      similarity: 0.82,
      kind: 'web',
      url: 'https://bankier.pl/btc',
      query: 'kurs bitcoina',
      sourceQuery: 'kurs bitcoin',
      used: true,
      read: true,
      ordinal: 3,
    };
    const getAllAsync = jest.fn().mockResolvedValue([
      {
        id: 5,
        chatId: 1,
        role: 'assistant',
        content: 'Answer.',
        sourceDocuments: JSON.stringify([everyField]),
      },
    ]);
    const mockDb = { getAllAsync } as Partial<SQLiteDatabase> as SQLiteDatabase;

    const messages = await getChatMessages(mockDb, 1);

    expect(messages[0].sourceDocuments?.[0]).toEqual(everyField);
  });

  it('numbers a document source too, not just a web one', async () => {
    const getAllAsync = jest.fn().mockResolvedValue([
      {
        id: 6,
        chatId: 1,
        role: 'assistant',
        content: 'Answer.',
        sourceDocuments: JSON.stringify([
          { documentId: 7, name: 'report.pdf', ordinal: 1 },
          { documentId: 8, name: 'notes.md' },
        ]),
      },
    ]);
    const mockDb = { getAllAsync } as Partial<SQLiteDatabase> as SQLiteDatabase;

    const messages = await getChatMessages(mockDb, 1);

    expect(
      messages[0].sourceDocuments?.map((source) => source.ordinal)
    ).toEqual([1, undefined]);
  });

  it('still cites the source the answer named after the chat is reloaded', async () => {
    const stored = [
      {
        name: 'Londyn — pogoda na weekend',
        url: 'https://pogoda.interia.pl/londyn',
        kind: 'web',
        ordinal: 1,
        used: true,
        passage:
          'Pogoda na weekend w Londynie. Sobota 19.09 temperatura 21°C, opady przelotne.',
      },
      {
        name: 'Met Office — London weekend forecast',
        url: 'https://www.metoffice.gov.uk/london',
        kind: 'web',
        ordinal: 2,
        used: true,
        passage:
          'London weekend forecast. Saturday 19 September highs of 21C with scattered showers.',
      },
    ];
    const answer =
      'W sobotę w Londynie temperatura sięgnie 21°C, a opady będą przelotne [2].';
    const getAllAsync = jest.fn().mockResolvedValue([
      {
        id: 6,
        chatId: 1,
        role: 'assistant',
        content: answer,
        sourceDocuments: JSON.stringify(stored),
      },
    ]);
    const mockDb = { getAllAsync } as Partial<SQLiteDatabase> as SQLiteDatabase;

    const messages = await getChatMessages(mockDb, 1);
    const blocks = attributeSourcesByBlock(
      answer,
      messages[0].sourceDocuments!
    );

    expect(blocks.map((block) => block.source?.ordinal)).toEqual([2]);
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
