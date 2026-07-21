import { retrieve } from '../utils/retrieval';
import type { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';

const embeddingBuffer = () => new Float32Array([1, 0]).buffer;

const seed = (chunkIndex: number, similarity: number) => ({
  id: `1:${chunkIndex}`,
  document: `chunk-${chunkIndex}`,
  embedding: [1, 0],
  similarity,
  metadata: { documentId: 1, name: 'report.txt' },
});

const neighborRow = (chunkIndex: number) => ({
  id: `1:${chunkIndex}`,
  document: `chunk-${chunkIndex}`,
  embedding: embeddingBuffer(),
  metadata: JSON.stringify({ documentId: 1, name: 'report.txt' }),
});

const makeVectorStore = (
  queryResults: unknown[],
  rowsById: Record<string, unknown>
) =>
  ({
    query: jest.fn().mockResolvedValue(queryResults),
    db: {
      execute: jest
        .fn()
        .mockImplementation(async (_sql: string, ids: string[]) => ({
          rows: ids.map((id) => rowsById[id]).filter(Boolean),
        })),
    },
  }) as unknown as OPSQLiteVectorStore;

describe('retrieve — neighbor expansion', () => {
  it('emits one document in reading order even when a later passage ranks higher', async () => {
    // Seed 1:10 outranks seed 1:2, so seed order alone would emit 9,10,11,1,2,3.
    const vectorStore = makeVectorStore([seed(10, 0.9), seed(2, 0.5)], {
      '1:9': neighborRow(9),
      '1:11': neighborRow(11),
      '1:1': neighborRow(1),
      '1:3': neighborRow(3),
    });

    const result = await retrieve({
      prompt: 'anything',
      enabledSourceIds: [1],
      vectorStore,
      sourceNamesById: new Map([[1, 'report.txt']]),
      embeddings: null,
    });

    expect(result.map((chunk) => chunk.document)).toEqual([
      'chunk-1',
      'chunk-2',
      'chunk-3',
      'chunk-9',
      'chunk-10',
      'chunk-11',
    ]);
  });
});
