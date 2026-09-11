import { writtenFiles } from '../__mocks__/expo-file-system';
import {
  exportChatRoom,
  importChatRoom,
} from '../database/exportImportRepository';
import { getChatMessages, type Message } from '../database/chatRepository';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import type { SQLiteDatabase } from 'expo-sqlite';

jest.mock('../database/chatRepository', () => ({
  getChatMessages: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

const mockGetChatMessages = getChatMessages as jest.Mock;
const mockShareAsync = Sharing.shareAsync as jest.Mock;
const mockGetDocument = DocumentPicker.getDocumentAsync as jest.Mock;

const db = {} as SQLiteDatabase;

const answerWithSources: Message = {
  id: 2,
  chatId: 1,
  role: 'assistant',
  content: 'Wędki dla początkujących kosztują od 90 zł do 250 zł.',
  timestamp: 2,
  modelName: 'Gemma 4 - 2B',
  tokensPerSecond: 5.1,
  timeToFirstToken: 33964,
  sourceDocuments: [
    {
      name: 'Ile kosztują wędki',
      kind: 'web',
      url: 'https://informatorwedkarski.pl/ceny',
      sourceQuery: 'wędka cena',
      read: true,
      used: true,
    },
    { documentId: 7, name: 'trip-brief.md', passage: 'Zakopane, 12-14.09' },
  ],
  groundingCaveats: ['figure'],
};

const history: Message[] = [
  {
    id: 1,
    chatId: 1,
    role: 'user',
    content: 'Ile kosztują wędki?',
    timestamp: 1,
  },
  answerWithSources,
];

const exportedPayload = async () => {
  mockGetChatMessages.mockResolvedValue(history);
  await exportChatRoom(db, 1, 'Wędki');
  const uri = mockShareAsync.mock.calls.at(-1)![0] as string;
  return JSON.parse(writtenFiles.get(uri)!);
};

beforeEach(() => {
  writtenFiles.clear();
  jest.clearAllMocks();
  mockShareAsync.mockResolvedValue(undefined);
  (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
});

describe('exportChatRoom', () => {
  it('carries the web sources of every answer, with the query that found them', async () => {
    const payload = await exportedPayload();

    expect(payload.history[1].sourceDocuments[0]).toEqual({
      name: 'Ile kosztują wędki',
      kind: 'web',
      url: 'https://informatorwedkarski.pl/ceny',
      sourceQuery: 'wędka cena',
      read: true,
      used: true,
    });
  });

  it('carries the cited document alongside the web pages', async () => {
    const payload = await exportedPayload();

    expect(payload.history[1].sourceDocuments[1]).toEqual({
      documentId: 7,
      name: 'trip-brief.md',
      passage: 'Zakopane, 12-14.09',
    });
  });

  it('carries the grounding caveats and the speed of the answer', async () => {
    const payload = await exportedPayload();

    expect(payload.history[1].groundingCaveats).toEqual(['figure']);
    expect(payload.history[1].tokensPerSecond).toBe(5.1);
    expect(payload.history[1].timeToFirstToken).toBe(33964);
  });

  it('shares the file it just wrote', async () => {
    await exportedPayload();

    expect(mockShareAsync).toHaveBeenCalledTimes(1);
    expect(mockShareAsync.mock.calls[0][0]).toContain(
      'file:///documents/chat-'
    );
  });
});

describe('importChatRoom', () => {
  const importOf = async (payload: unknown) => {
    const uri = 'file:///cache/incoming.json';
    writtenFiles.set(uri, JSON.stringify(payload));
    mockGetDocument.mockResolvedValue({ canceled: false, assets: [{ uri }] });
    return importChatRoom();
  };

  it('brings the sources and caveats back with the messages', async () => {
    const payload = await exportedPayload();

    const imported = await importOf(payload);

    expect(imported?.title).toBe('Wędki');
    expect(imported?.messages[1].sourceDocuments).toHaveLength(2);
    expect(imported?.messages[1].groundingCaveats).toEqual(['figure']);
  });

  it('refuses a file that is not a chat export', async () => {
    expect(await importOf({ some: 'other json' })).toBeUndefined();
  });
});
