import { useSourceStore } from '../store/sourceStore';
import * as sourcesRepository from '../database/sourcesRepository';
import * as fileReaders from '../utils/fileReaders';
import { useLLMStore } from '../store/llmStore';

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

const mockDb = {} as any;
const mockVectorStore = { add: jest.fn() } as any;

const mockReadDocumentText = fileReaders.readDocumentText as jest.Mock;
const mockInsertSource = sourcesRepository.insertSource as jest.Mock;
const mockDeleteSource = sourcesRepository.deleteSource as jest.Mock;
const mockDeleteSourceFromChats = sourcesRepository.deleteSourceFromChats as jest.Mock;
const mockGetAllSources = sourcesRepository.getAllSources as jest.Mock;
const mockRenameSource = sourcesRepository.renameSource as jest.Mock;
const mockRefreshActiveChatMessages = jest.fn();

import { RecursiveCharacterTextSplitter } from 'react-native-rag';
const MockSplitter = RecursiveCharacterTextSplitter as jest.Mock;

beforeEach(() => {
  useSourceStore.setState({ sources: [], db: mockDb, isReading: false });
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockGetAllSources.mockResolvedValue([]);
  ;(useLLMStore.getState as jest.Mock).mockReturnValue({
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
    let capturedSources: any[] = [];
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
    expect(result).toEqual({ success: true });
    expect(sources).toHaveLength(1);
    expect(sources[0].id).toBe(99);
    expect(sources[0].isProcessing).toBe(false);
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

    expect(mockVectorStore.add).toHaveBeenCalledTimes(3);
    expect(mockVectorStore.add).toHaveBeenCalledWith({
      document: 'a',
      metadata: { documentId: 1 },
    });
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
