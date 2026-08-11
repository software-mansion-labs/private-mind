import { restoreTruncatedChatTitles } from '../database/chatTitleMigration';
import { MAX_CHAT_TITLE_LENGTH } from '../utils/chatLabel';

type Row = { id: number; title: string };
type FirstMessage = { content: string | null; documentName: string | null };

const makeDb = (chats: Row[], messages: Record<number, FirstMessage>) => {
  const updates: Array<[number, string]> = [];
  const db = {
    getAllAsync: jest.fn(async () =>
      chats.filter(
        (chat) => chat.title.endsWith('...') && chat.title.length === 28
      )
    ),
    getFirstAsync: jest.fn(
      async (_sql: string, chatId: number) => messages[chatId] ?? null
    ),
    runAsync: jest.fn(async (_sql: string, title: string, id: number) => {
      updates.push([id, title]);
    }),
  };
  return { db: db as any, updates };
};

describe('restoreTruncatedChatTitles', () => {
  it('rebuilds a truncated title from the first user message', async () => {
    const { db, updates } = makeDb(
      [{ id: 1, title: 'Can you explain how machi...' }],
      {
        1: {
          content:
            'Can you explain how machine learning works in simple terms?',
          documentName: null,
        },
      }
    );

    await expect(restoreTruncatedChatTitles(db)).resolves.toBe(1);
    expect(updates).toEqual([
      [1, 'Can you explain how machine learning works in simple terms?'],
    ]);
  });

  it('caps a rebuilt title at the stored maximum', async () => {
    const message = 'a'.repeat(MAX_CHAT_TITLE_LENGTH + 40);
    const { db, updates } = makeDb([{ id: 1, title: `${'a'.repeat(25)}...` }], {
      1: { content: message, documentName: null },
    });

    await restoreTruncatedChatTitles(db);
    expect(updates[0][1]).toBe('a'.repeat(MAX_CHAT_TITLE_LENGTH));
  });

  it('rebuilds from the document name when the message carried no text', async () => {
    const { db, updates } = makeDb(
      [{ id: 1, title: 'Regulamin szkolenia 2024 ...' }],
      {
        1: {
          content: '',
          documentName: 'Regulamin szkolenia 2024 - warunki.pdf',
        },
      }
    );

    await restoreTruncatedChatTitles(db);
    expect(updates).toEqual([[1, 'Regulamin szkolenia 2024 - warunki.pdf']]);
  });

  it('leaves a title alone when the first message does not match the stub', async () => {
    const { db, updates } = makeDb(
      [{ id: 1, title: 'The plan for next week is...' }],
      { 1: { content: 'Something else entirely', documentName: null } }
    );

    await expect(restoreTruncatedChatTitles(db)).resolves.toBe(0);
    expect(updates).toEqual([]);
  });

  it('leaves a title alone when the chat has no user message left', async () => {
    const { db, updates } = makeDb(
      [{ id: 1, title: 'Can you explain how machi...' }],
      {}
    );

    await expect(restoreTruncatedChatTitles(db)).resolves.toBe(0);
    expect(updates).toEqual([]);
  });

  it('does not touch titles that were never truncated', async () => {
    const { db, updates } = makeDb([{ id: 1, title: 'Trip to Rome' }], {
      1: { content: 'Trip to Rome', documentName: null },
    });

    await expect(restoreTruncatedChatTitles(db)).resolves.toBe(0);
    expect(updates).toEqual([]);
  });
});
