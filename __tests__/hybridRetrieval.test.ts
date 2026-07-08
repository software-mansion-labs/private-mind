import { hybridRetrieve } from '../utils/hybridRetrieval';
import * as keywordIndex from '../database/keywordIndex';

jest.mock('../database/keywordIndex', () => ({
  keywordSearch: jest.fn(),
}));

const mockKeywordSearch = keywordIndex.keywordSearch as jest.Mock;

const makeVectorStore = (
  queryResults: any[],
  vectorsById: Record<string, any>
) =>
  ({
    query: jest.fn().mockResolvedValue(queryResults),
    db: {
      execute: jest
        .fn()
        .mockImplementation(async (_sql: string, ids: string[]) => ({
          rows: ids.map((id) => vectorsById[id]).filter(Boolean),
        })),
    },
  }) as any;

describe('hybridRetrieve', () => {
  beforeEach(() => {
    mockKeywordSearch.mockReset();
  });

  it('recovers a keyword-only chunk that vector search missed', async () => {
    const vectorResults = [
      {
        id: '1:0',
        document: 'a semantic passage about felines',
        embedding: [1, 0],
        similarity: 0.8,
        metadata: { documentId: 1, name: 'A' },
      },
    ];
    const vectorsById = {
      '2:5': {
        id: '2:5',
        document: 'the exact code E4021 is documented here',
        embedding: [0, 1],
        metadata: JSON.stringify({ documentId: 2, name: 'B' }),
      },
    };
    mockKeywordSearch.mockResolvedValue([
      { chunkId: '2:5', documentId: 2, score: -1.2 },
    ]);

    const result = await hybridRetrieve({
      prompt: 'E4021',
      enabledSourceIds: [1, 2],
      vectorStore: makeVectorStore(vectorResults, vectorsById),
      sourceNamesById: new Map(),
      embeddings: null,
    });

    const names = result.map((c) => c.metadata?.name);
    expect(names).toContain('B');
    expect(names).toContain('A');
  });

  it('gates out low-similarity vector filler with no keyword overlap', async () => {
    const vectorResults = [
      {
        id: '1:0',
        document: 'exact code E4021 explained',
        embedding: [1, 0],
        similarity: 0.7,
        metadata: { documentId: 1, name: 'Relevant' },
      },
      {
        id: '1:9',
        document: 'completely unrelated boilerplate text',
        embedding: [0, 1],
        similarity: 0.05,
        metadata: { documentId: 1, name: 'Filler' },
      },
    ];
    mockKeywordSearch.mockResolvedValue([]);

    const result = await hybridRetrieve({
      prompt: 'E4021',
      enabledSourceIds: [1],
      vectorStore: makeVectorStore(vectorResults, {}),
      sourceNamesById: new Map(),
      embeddings: null,
    });

    const names = result.map((c) => c.metadata?.name);
    expect(names).toContain('Relevant');
    expect(names).not.toContain('Filler');
  });

  it('returns an empty list when nothing qualifies', async () => {
    mockKeywordSearch.mockResolvedValue([]);

    const result = await hybridRetrieve({
      prompt: 'xyz',
      enabledSourceIds: [1],
      vectorStore: makeVectorStore(
        [
          {
            id: '1:0',
            document: 'irrelevant',
            embedding: [1, 0],
            similarity: 0.02,
            metadata: { documentId: 1, name: 'A' },
          },
        ],
        {}
      ),
      sourceNamesById: new Map(),
      embeddings: null,
    });

    expect(result).toEqual([]);
  });

  it('falls back to sourceNamesById when a chunk has no name in metadata', async () => {
    mockKeywordSearch.mockResolvedValue([]);

    const result = await hybridRetrieve({
      prompt: 'anything relevant',
      enabledSourceIds: [7],
      vectorStore: makeVectorStore(
        [
          {
            id: '7:0',
            document: 'relevant content',
            embedding: [1, 0],
            similarity: 0.9,
            metadata: { documentId: 7 },
          },
        ],
        {}
      ),
      sourceNamesById: new Map([[7, 'Resolved Name']]),
      embeddings: null,
    });

    expect(result[0]?.metadata?.name).toBe('Resolved Name');
  });

  it('ranks a freshly attached source first even when it would otherwise be gated out', async () => {
    const vectorResults = [
      {
        id: '1:0',
        document: 'older enabled document that mentions the pdf keyword',
        embedding: [1, 0],
        similarity: 0.2,
        metadata: { documentId: 1, name: 'Old' },
      },
      {
        id: '2:0',
        document: 'brand new attachment about an espresso machine',
        embedding: [0, 1],
        similarity: 0.05,
        metadata: { documentId: 2, name: 'Attachment' },
      },
    ];
    mockKeywordSearch.mockResolvedValue([
      { chunkId: '1:0', documentId: 1, score: -1 },
    ]);

    const result = await hybridRetrieve({
      prompt: 'what is the pdf about',
      enabledSourceIds: [1, 2],
      attachmentSourceIds: [2],
      vectorStore: makeVectorStore(vectorResults, {}),
      sourceNamesById: new Map(),
      embeddings: null,
    });

    const names = result.map((c) => c.metadata?.name);
    expect(names[0]).toBe('Attachment');
    expect(names).toContain('Old');
  });

  it('gates out a mid-similarity chunk with no lexical overlap (embedding noise floor)', async () => {
    mockKeywordSearch.mockResolvedValue([]);
    const result = await hybridRetrieve({
      prompt: 'napisz wiersz o jesieni',
      enabledSourceIds: [1],
      vectorStore: makeVectorStore(
        [
          {
            id: '1:0',
            document: 'privacy policy: data never leaves the device',
            embedding: [1, 0],
            similarity: 0.45,
            metadata: { documentId: 1, name: 'FAQ' },
          },
        ],
        {}
      ),
      sourceNamesById: new Map(),
      embeddings: null,
    });

    expect(result).toEqual([]);
  });

  it('keeps a mid-similarity chunk when the query shares terms with it', async () => {
    mockKeywordSearch.mockResolvedValue([]);
    const result = await hybridRetrieve({
      prompt: 'does data leave the device',
      enabledSourceIds: [1],
      vectorStore: makeVectorStore(
        [
          {
            id: '1:0',
            document: 'privacy policy: data never leaves the device',
            embedding: [1, 0],
            similarity: 0.45,
            metadata: { documentId: 1, name: 'FAQ' },
          },
        ],
        {}
      ),
      sourceNamesById: new Map(),
      embeddings: null,
    });

    expect(result.map((c) => c.metadata?.name)).toContain('FAQ');
  });

  it('caps one document so a second enabled source is not fully evicted', async () => {
    const vectorResults = [
      {
        id: '1:0',
        document: 'doc a passage one',
        embedding: [1, 0, 0, 0, 0],
        similarity: 0.9,
        metadata: { documentId: 1, name: 'DocA' },
      },
      {
        id: '1:1',
        document: 'doc a passage two',
        embedding: [0, 1, 0, 0, 0],
        similarity: 0.88,
        metadata: { documentId: 1, name: 'DocA' },
      },
      {
        id: '1:2',
        document: 'doc a passage three',
        embedding: [0, 0, 1, 0, 0],
        similarity: 0.86,
        metadata: { documentId: 1, name: 'DocA' },
      },
      {
        id: '1:3',
        document: 'doc a passage four',
        embedding: [0, 0, 0, 1, 0],
        similarity: 0.84,
        metadata: { documentId: 1, name: 'DocA' },
      },
      {
        id: '1:4',
        document: 'doc a passage five',
        embedding: [0, 0, 0, 0, 1],
        similarity: 0.82,
        metadata: { documentId: 1, name: 'DocA' },
      },
      {
        id: '2:0',
        document: 'doc b passage',
        embedding: [1, 1, 0, 0, 0],
        similarity: 0.6,
        metadata: { documentId: 2, name: 'DocB' },
      },
    ];
    mockKeywordSearch.mockResolvedValue([]);

    const result = await hybridRetrieve({
      prompt: 'zzz',
      enabledSourceIds: [1, 2],
      vectorStore: makeVectorStore(vectorResults, {}),
      sourceNamesById: new Map(),
      embeddings: null,
    });

    expect(result.map((c) => c.metadata?.name)).toContain('DocB');
  });

  it('adaptive-k drops a weak non-adjacent chunk after a large relevance gap', async () => {
    const vectorResults = [
      {
        id: '1:0',
        document: 'the exact code e4021 is here',
        embedding: [1, 0],
        similarity: 0.9,
        metadata: { documentId: 1, name: 'DocA' },
      },
      {
        id: '1:5',
        document: 'unrelated filler paragraph',
        embedding: [0, 1],
        similarity: 0.58,
        metadata: { documentId: 1, name: 'DocA' },
      },
    ];
    mockKeywordSearch.mockResolvedValue([
      { chunkId: '1:0', documentId: 1, score: -1 },
    ]);

    const result = await hybridRetrieve({
      prompt: 'e4021',
      enabledSourceIds: [1],
      vectorStore: makeVectorStore(vectorResults, {}),
      sourceNamesById: new Map(),
      embeddings: null,
    });

    const docs = result.map((c) => c.document);
    expect(docs).toContain('the exact code e4021 is here');
    expect(docs).not.toContain('unrelated filler paragraph');
  });

  it('orders a more-relevant later chunk ahead of a less-relevant earlier one', async () => {
    const vectorResults = [
      {
        id: '1:2',
        document: 'table of contents item 14 principal accountant fees',
        embedding: [1, 0],
        similarity: 0.5,
        metadata: { documentId: 1, name: 'AppleK' },
      },
      {
        id: '1:20',
        document: 'ben borders will assume the role of principal accounting officer',
        embedding: [0, 1],
        similarity: 0.9,
        metadata: { documentId: 1, name: 'AppleK' },
      },
    ];
    mockKeywordSearch.mockResolvedValue([
      { chunkId: '1:20', documentId: 1, score: -1 },
      { chunkId: '1:2', documentId: 1, score: -1.1 },
    ]);

    const result = await hybridRetrieve({
      prompt: 'who becomes principal accounting officer',
      enabledSourceIds: [1],
      vectorStore: makeVectorStore(vectorResults, {}),
      sourceNamesById: new Map(),
      embeddings: null,
    });

    const docs = result.map((c) => c.document);
    expect(docs).toContain(
      'ben borders will assume the role of principal accounting officer'
    );
    expect(docs[0]).toContain('ben borders');
    expect(docs.indexOf('ben borders will assume the role of principal accounting officer')).toBeLessThan(
      docs.indexOf('table of contents item 14 principal accountant fees')
    );
  });

  it('leads with the best seed window even when it sits late in the document (with neighbors)', async () => {
    const vectorResults = [
      {
        id: '1:2',
        document: 'toc item 14 principal accountant fees and services',
        embedding: [1, 0],
        similarity: 0.44,
        metadata: { documentId: 1, name: 'AppleK' },
      },
      {
        id: '1:20',
        document: 'item 9b ben borders will assume principal accounting officer',
        embedding: [0, 1],
        similarity: 0.5,
        metadata: { documentId: 1, name: 'AppleK' },
      },
    ];
    const vectorsById = {
      '1:1': {
        id: '1:1',
        document: 'toc neighbor before',
        embedding: [1, 0],
        metadata: JSON.stringify({ documentId: 1, name: 'AppleK' }),
      },
      '1:3': {
        id: '1:3',
        document: 'toc neighbor after',
        embedding: [1, 0],
        metadata: JSON.stringify({ documentId: 1, name: 'AppleK' }),
      },
      '1:19': {
        id: '1:19',
        document: 'item 9b neighbor before',
        embedding: [0, 1],
        metadata: JSON.stringify({ documentId: 1, name: 'AppleK' }),
      },
      '1:21': {
        id: '1:21',
        document: 'item 9b neighbor after',
        embedding: [0, 1],
        metadata: JSON.stringify({ documentId: 1, name: 'AppleK' }),
      },
    };
    mockKeywordSearch.mockResolvedValue([
      { chunkId: '1:20', documentId: 1, score: -1 },
      { chunkId: '1:2', documentId: 1, score: -1.1 },
    ]);

    const result = await hybridRetrieve({
      prompt: 'who becomes principal accounting officer',
      enabledSourceIds: [1],
      vectorStore: makeVectorStore(vectorResults, vectorsById),
      sourceNamesById: new Map(),
      embeddings: null,
    });

    const docs = result.map((c) => c.document);
    const lastNine = Math.max(
      docs.indexOf('item 9b neighbor before'),
      docs.indexOf('item 9b ben borders will assume principal accounting officer'),
      docs.indexOf('item 9b neighbor after')
    );
    const firstToc = Math.min(
      docs.indexOf('toc neighbor before'),
      docs.indexOf('toc item 14 principal accountant fees and services'),
      docs.indexOf('toc neighbor after')
    );
    expect(lastNine).toBeLessThan(firstToc);
  });

  it('expands a selected chunk with its same-document neighbors, in order', async () => {
    const vectorResults = [
      {
        id: '1:2',
        document: 'middle of the table row 3',
        embedding: [1, 0],
        similarity: 0.9,
        metadata: { documentId: 1, name: 'Invoice' },
      },
    ];
    const vectorsById = {
      '1:1': {
        id: '1:1',
        document: 'table header and rows 1-2',
        embedding: [1, 0],
        metadata: JSON.stringify({ documentId: 1, name: 'Invoice' }),
      },
      '1:3': {
        id: '1:3',
        document: 'table rows 4-6 and totals',
        embedding: [1, 0],
        metadata: JSON.stringify({ documentId: 1, name: 'Invoice' }),
      },
    };
    mockKeywordSearch.mockResolvedValue([]);

    const result = await hybridRetrieve({
      prompt: 'what is in the table',
      enabledSourceIds: [1],
      vectorStore: makeVectorStore(vectorResults, vectorsById),
      sourceNamesById: new Map(),
      embeddings: null,
    });

    expect(result.map((c) => c.document)).toEqual([
      'table header and rows 1-2',
      'middle of the table row 3',
      'table rows 4-6 and totals',
    ]);
    expect(new Set(result.map((c) => c.metadata?.name))).toEqual(
      new Set(['Invoice'])
    );
    expect(result.map((c) => c.similarity)).toEqual([0, 0.9, 0]);
  });
});
