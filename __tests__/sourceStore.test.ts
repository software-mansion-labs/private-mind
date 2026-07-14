import { useSourceStore } from '../store/sourceStore';
import * as sourcesRepository from '../database/sourcesRepository';
import type { Source } from '../database/sourcesRepository';
import * as fileReaders from '../utils/fileReaders';
import { useLLMStore } from '../store/llmStore';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import type { LFMEmbeddings } from '../utils/lfmEmbeddings';
import { MAX_SOURCE_CHUNKS } from '../constants/retrieval';

jest.mock('../database/sourcesRepository');
jest.mock('../utils/fileReaders');
jest.mock('../store/llmStore', () => ({
  useLLMStore: {
    getState: jest.fn(() => ({
      refreshActiveChatMessages: jest.fn(),
    })),
  },
}));
jest.mock('react-native-rag', () => ({
  RecursiveCharacterTextSplitter: jest.fn().mockImplementation(() => ({
    splitText: jest.fn(),
  })),
}));
jest.mock('@react-native-rag/op-sqlite', () => ({}));

const mockDb = {} as Partial<SQLiteDatabase> as SQLiteDatabase;
const vectorStoreAdd = jest.fn();
const vectorStoreDelete = jest.fn();
const mockVectorStore = {
  add: vectorStoreAdd,
  delete: vectorStoreDelete,
} as Partial<OPSQLiteVectorStore> as OPSQLiteVectorStore;

const mockReadDocumentText = fileReaders.readDocumentText as jest.Mock;
const mockInsertSource = sourcesRepository.insertSource as jest.Mock;
const mockDeleteSource = sourcesRepository.deleteSource as jest.Mock;
const mockDeleteSourceFromChats =
  sourcesRepository.deleteSourceFromChats as jest.Mock;
const mockGetAllSources = sourcesRepository.getAllSources as jest.Mock;
const mockRenameSource = sourcesRepository.renameSource as jest.Mock;
const mockGetOrphanedSources =
  sourcesRepository.getOrphanedSources as jest.Mock;
const mockRefreshActiveChatMessages = jest.fn();

import { RecursiveCharacterTextSplitter } from 'react-native-rag';
const MockSplitter = RecursiveCharacterTextSplitter as jest.Mock;

beforeEach(() => {
  useSourceStore.setState({ sources: [], db: mockDb, isReading: false });
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockGetAllSources.mockResolvedValue([]);
  mockGetOrphanedSources.mockResolvedValue([]);
  (useLLMStore.getState as jest.Mock).mockReturnValue({
    refreshActiveChatMessages: mockRefreshActiveChatMessages,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const baseSource = { name: 'doc.txt', type: 'txt', size: 100 };

describe('addSource', () => {
  it('returns { success: false } when db is not set', async () => {
    useSourceStore.setState({ db: null });
    const result = await useSourceStore
      .getState()
      .addSource(baseSource, '/path/doc.txt', mockVectorStore);
    expect(result).toEqual({ success: false });
  });

  it('returns { success: false, isEmpty: true } for empty document', async () => {
    mockReadDocumentText.mockResolvedValue('   ');
    const result = await useSourceStore
      .getState()
      .addSource(baseSource, '/path/doc.txt', mockVectorStore);
    expect(result).toEqual({ success: false, isEmpty: true });
    expect(useSourceStore.getState().isReading).toBe(false);
  });

  it('flags a PDF with no extractable text as scanned', async () => {
    mockReadDocumentText.mockResolvedValue('');
    const result = await useSourceStore
      .getState()
      .addSource(
        { name: 'scan.pdf', type: 'pdf', size: 100 },
        '/path/scan.pdf',
        mockVectorStore
      );
    expect(result).toEqual({
      success: false,
      isEmpty: true,
      reason: 'scanned_pdf',
    });
  });

  it('sets isReading to true during processing then false on success', async () => {
    mockReadDocumentText.mockResolvedValue('some content');
    mockInsertSource.mockResolvedValue(42);
    MockSplitter.mockImplementation(() => ({
      splitText: jest.fn().mockResolvedValue(['chunk1']),
    }));

    const promise = useSourceStore
      .getState()
      .addSource(baseSource, '/path/doc.txt', mockVectorStore);

    await promise;
    expect(useSourceStore.getState().isReading).toBe(false);
  });

  it('adds a temp source with negative id and isProcessing=true before DB insert', async () => {
    let capturedSources: Source[] = [];
    mockReadDocumentText.mockResolvedValue('content');
    mockInsertSource.mockImplementation(async () => {
      capturedSources = useSourceStore.getState().sources;
      return 10;
    });
    MockSplitter.mockImplementation(() => ({
      splitText: jest.fn().mockResolvedValue(['chunk']),
    }));

    await useSourceStore
      .getState()
      .addSource(baseSource, '/path/doc.txt', mockVectorStore);

    expect(capturedSources).toHaveLength(1);
    expect(capturedSources[0].id).toBeLessThan(0);
    expect(capturedSources[0].isProcessing).toBe(true);
  });

  it('replaces temp source with real id and isProcessing=false on success', async () => {
    mockReadDocumentText.mockResolvedValue('content');
    mockInsertSource.mockResolvedValue(99);
    MockSplitter.mockImplementation(() => ({
      splitText: jest.fn().mockResolvedValue(['chunk']),
    }));

    const result = await useSourceStore
      .getState()
      .addSource(baseSource, '/path/doc.txt', mockVectorStore);

    const sources = useSourceStore.getState().sources;
    expect(result).toEqual({ success: true, sourceId: 99, truncated: false });
    expect(sources).toHaveLength(1);
    expect(sources[0].id).toBe(99);
    expect(sources[0].isProcessing).toBe(false);
  });

  it('caps embedded chunks at MAX_SOURCE_CHUNKS and flags the result truncated', async () => {
    mockReadDocumentText.mockResolvedValue('content');
    mockInsertSource.mockResolvedValue(99);
    const manyChunks = Array.from(
      { length: MAX_SOURCE_CHUNKS + 1 },
      (_, i) => `chunk-${i}`
    );
    MockSplitter.mockImplementation(() => ({
      splitText: jest.fn().mockResolvedValue(manyChunks),
    }));

    const result = await useSourceStore
      .getState()
      .addSource(baseSource, '/path/doc.txt', mockVectorStore);

    expect(result).toEqual({ success: true, sourceId: 99, truncated: true });
    expect(vectorStoreAdd).toHaveBeenCalledTimes(MAX_SOURCE_CHUNKS);
  });

  it('aborts embedding and rolls back the partial source when the signal is aborted', async () => {
    mockReadDocumentText.mockResolvedValue('content');
    mockInsertSource.mockResolvedValue(99);
    MockSplitter.mockImplementation(() => ({
      splitText: jest.fn().mockResolvedValue(['chunk-a', 'chunk-b']),
    }));
    const controller = new AbortController();
    controller.abort();

    const result = await useSourceStore
      .getState()
      .addSource(
        baseSource,
        '/path/doc.txt',
        mockVectorStore,
        undefined,
        undefined,
        controller.signal
      );

    expect(result).toEqual({ success: false, cancelled: true });
    expect(vectorStoreAdd).not.toHaveBeenCalled();
    expect(vectorStoreDelete).toHaveBeenCalledTimes(1);
    expect(mockDeleteSource).toHaveBeenCalledWith(mockDb, 99);
    expect(useSourceStore.getState().sources).toHaveLength(0);
  });

  it('passes firstChunk to insertSource', async () => {
    mockReadDocumentText.mockResolvedValue('content');
    mockInsertSource.mockResolvedValue(1);
    MockSplitter.mockImplementation(() => ({
      splitText: jest
        .fn()
        .mockResolvedValue(['first chunk text', 'second chunk']),
    }));

    await useSourceStore
      .getState()
      .addSource(baseSource, '/path/doc.txt', mockVectorStore);

    expect(mockInsertSource).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ firstChunk: 'first chunk text' })
    );
  });

  it('calls vectorStore.add once per chunk', async () => {
    mockReadDocumentText.mockResolvedValue('content');
    mockInsertSource.mockResolvedValue(1);
    MockSplitter.mockImplementation(() => ({
      splitText: jest.fn().mockResolvedValue(['a', 'b', 'c']),
    }));

    await useSourceStore
      .getState()
      .addSource(baseSource, '/path/doc.txt', mockVectorStore);

    expect(vectorStoreAdd).toHaveBeenCalledTimes(3);
    expect(vectorStoreAdd).toHaveBeenCalledWith({
      id: '1:0',
      document: 'a',
      embedding: undefined,
      metadata: {
        documentId: 1,
        name: 'doc.txt',
        chunkIndex: 0,
        isFirstChunk: true,
      },
    });
    expect(vectorStoreAdd).toHaveBeenCalledWith({
      id: '1:1',
      document: 'b',
      embedding: undefined,
      metadata: {
        documentId: 1,
        name: 'doc.txt',
        chunkIndex: 1,
        isFirstChunk: false,
      },
    });
  });

  it('embeds each chunk with the document prefix when embeddings are provided', async () => {
    mockReadDocumentText.mockResolvedValue('content');
    mockInsertSource.mockResolvedValue(1);
    MockSplitter.mockImplementation(() => ({
      splitText: jest.fn().mockResolvedValue(['a', 'b']),
    }));
    const embedDocument = jest
      .fn()
      .mockImplementation(async (text: string) => [text.length]);

    await useSourceStore
      .getState()
      .addSource(baseSource, '/path/doc.txt', mockVectorStore, {
        embedDocument,
      } as Partial<LFMEmbeddings> as LFMEmbeddings);

    expect(embedDocument).toHaveBeenCalledWith('a');
    expect(embedDocument).toHaveBeenCalledWith('b');
    expect(vectorStoreAdd).toHaveBeenCalledWith(
      expect.objectContaining({ document: 'a', embedding: [1] })
    );
  });

  it('removes temp source and resets isReading when DB insert fails', async () => {
    mockReadDocumentText.mockResolvedValue('content');
    mockInsertSource.mockResolvedValue(null); // insert failure
    MockSplitter.mockImplementation(() => ({
      splitText: jest.fn().mockResolvedValue(['chunk']),
    }));

    const result = await useSourceStore
      .getState()
      .addSource(baseSource, '/path/doc.txt', mockVectorStore);

    expect(result).toEqual({ success: false });
    expect(useSourceStore.getState().sources).toHaveLength(0);
    expect(useSourceStore.getState().isReading).toBe(false);
  });

  it('cleans up temp source and resets isReading when an exception is thrown', async () => {
    mockReadDocumentText.mockRejectedValue(new Error('read error'));

    const result = await useSourceStore
      .getState()
      .addSource(baseSource, '/path/doc.txt', mockVectorStore);

    expect(result).toEqual({ success: false });
    expect(useSourceStore.getState().sources).toHaveLength(0);
    expect(useSourceStore.getState().isReading).toBe(false);
  });
});

describe('deleteSource', () => {
  it('calls deleteSource and deleteSourceFromChats then reloads', async () => {
    mockDeleteSource.mockResolvedValue(undefined);
    mockDeleteSourceFromChats.mockResolvedValue(undefined);
    mockGetAllSources.mockResolvedValue([]);

    const source = { id: 5, name: 'doc.txt', type: 'txt', size: 100 };
    await useSourceStore.getState().deleteSource(source);

    expect(mockDeleteSource).toHaveBeenCalledWith(mockDb, 5);
    expect(mockDeleteSourceFromChats).toHaveBeenCalledWith(mockDb, source);
  });

  it('calls refreshActiveChatMessages on the LLM store after deleting', async () => {
    mockDeleteSource.mockResolvedValue(undefined);
    mockDeleteSourceFromChats.mockResolvedValue(undefined);
    mockGetAllSources.mockResolvedValue([]);

    await useSourceStore
      .getState()
      .deleteSource({ id: 1, name: 'f', type: 'txt', size: 0 });

    expect(mockRefreshActiveChatMessages).toHaveBeenCalled();
  });
});

describe('renameSource', () => {
  it('calls renameSource in DB then reloads sources', async () => {
    mockRenameSource.mockResolvedValue(undefined);
    const updated = [{ id: 1, name: 'new-name.txt', type: 'txt', size: 0 }];
    mockGetAllSources.mockResolvedValue(updated);

    await useSourceStore.getState().renameSource(1, 'new-name.txt');

    expect(mockRenameSource).toHaveBeenCalledWith(mockDb, 1, 'new-name.txt');
    expect(useSourceStore.getState().sources).toEqual(updated);
  });
});

describe('setSourceProcessing', () => {
  it('updates isProcessing flag on the correct source', () => {
    useSourceStore.setState({
      sources: [
        { id: 1, name: 'a.txt', type: 'txt', size: 0, isProcessing: false },
        { id: 2, name: 'b.txt', type: 'txt', size: 0, isProcessing: false },
      ],
    });

    useSourceStore.getState().setSourceProcessing(1, true);

    const sources = useSourceStore.getState().sources;
    expect(sources.find((s) => s.id === 1)?.isProcessing).toBe(true);
    expect(sources.find((s) => s.id === 2)?.isProcessing).toBe(false);
  });
});

describe('cleanupOrphanedSources', () => {
  it('deletes orphaned sources and their vector embeddings', async () => {
    const orphaned = [{ id: 5, name: 'orphan.pdf', type: 'pdf', size: 100 }];
    mockGetOrphanedSources.mockResolvedValue(orphaned);
    mockDeleteSource.mockResolvedValue(undefined);

    const orphanVectorStoreDelete = jest.fn();
    const mockVectorStoreWithDelete = {
      add: vectorStoreAdd,
      delete: orphanVectorStoreDelete,
    } as Partial<OPSQLiteVectorStore> as OPSQLiteVectorStore;

    await useSourceStore
      .getState()
      .cleanupOrphanedSources(mockVectorStoreWithDelete);

    expect(mockGetOrphanedSources).toHaveBeenCalledWith(mockDb);
    expect(mockDeleteSource).toHaveBeenCalledWith(mockDb, 5);
    expect(orphanVectorStoreDelete).toHaveBeenCalledWith({
      predicate: expect.any(Function),
    });
  });

  it('does nothing when there are no orphaned sources', async () => {
    mockGetOrphanedSources.mockResolvedValue([]);

    await useSourceStore.getState().cleanupOrphanedSources(mockVectorStore);

    expect(mockDeleteSource).not.toHaveBeenCalled();
  });

  it('reloads sources after cleanup', async () => {
    const orphaned = [{ id: 3, name: 'old.txt', type: 'txt', size: 50 }];
    mockGetOrphanedSources.mockResolvedValue(orphaned);
    mockDeleteSource.mockResolvedValue(undefined);
    const updated = [{ id: 1, name: 'kept.txt', type: 'txt', size: 100 }];
    mockGetAllSources.mockResolvedValue(updated);

    const mockVectorStoreWithDelete = {
      add: vectorStoreAdd,
      delete: jest.fn(),
    } as Partial<OPSQLiteVectorStore> as OPSQLiteVectorStore;

    await useSourceStore
      .getState()
      .cleanupOrphanedSources(mockVectorStoreWithDelete);

    expect(useSourceStore.getState().sources).toEqual(updated);
  });
});
