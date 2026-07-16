import {
  buildMessageSources,
  pickCitationsByAnswer,
  restrictCitationsToContext,
  type SourceRow,
} from '../utils/messageSources';
import { sourcesPresentInContext } from '../utils/contextUtils';
import type { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';

type VectorRow = {
  id: string;
  document: string;
  embedding: number[];
  similarity: number;
  metadata: { documentId: number; name?: string };
};

const makeVectorStore = (queryResults: VectorRow[]) => {
  const byId = new Map(queryResults.map((r) => [r.id, r]));
  return {
    query: jest.fn().mockResolvedValue(queryResults),
    db: {
      execute: jest
        .fn()
        .mockImplementation(async (_sql: string, ids: string[]) => ({
          rows: ids
            .map((id) => byId.get(id))
            .filter(Boolean)
            .map((r) => ({
              id: r!.id,
              document: r!.document,
              embedding: r!.embedding,
              metadata: JSON.stringify(r!.metadata),
            })),
        })),
    },
  } as unknown as OPSQLiteVectorStore;
};

const source = (id: number, name: string, firstChunk?: string): SourceRow => ({
  id,
  name,
  firstChunk,
});

const presentNames = (context: string[]): Set<string> =>
  sourcesPresentInContext(context.join('\n'));

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('buildMessageSources — retrieval → context → citation pipeline', () => {
  it('keeps context "Source N" headers and the citation set in lockstep across two documents', async () => {
    const vectorStore = makeVectorStore([
      {
        id: '1:0',
        document: 'vacation policy grants twenty six days of paid leave',
        embedding: [1, 0],
        similarity: 0.85,
        metadata: { documentId: 1, name: 'handbook.pdf' },
      },
      {
        id: '2:0',
        document: 'quarterly revenue reached five million dollars',
        embedding: [0, 1],
        similarity: 0.82,
        metadata: { documentId: 2, name: 'q4_report.pdf' },
      },
    ]);

    const { context, sourceDocuments, preferredSourceDocuments } =
      await buildMessageSources({
        userInput: 'how many vacation days and what was the revenue',
        attachmentSourceIds: [],
        enabledSources: [1, 2],
        sources: [source(1, 'handbook.pdf'), source(2, 'q4_report.pdf')],
        vectorStore,
        embeddings: null,
      });

    expect(context.join('\n')).toContain('--- Source 1:');
    expect(context.join('\n')).toContain('--- Source 2:');

    const citedNames = new Set(sourceDocuments.map((d) => d.name));
    expect(citedNames).toEqual(presentNames(context));
    expect(citedNames).toEqual(new Set(['handbook.pdf', 'q4_report.pdf']));
    expect(preferredSourceDocuments).toEqual([]);
  });

  it('prepends the attachment overview and orders the attachment first in the citations', async () => {
    const vectorStore = makeVectorStore([
      {
        id: '1:0',
        document: 'older library document about vacation policy',
        embedding: [1, 0],
        similarity: 0.8,
        metadata: { documentId: 1, name: 'library.pdf' },
      },
      {
        id: '2:0',
        document: 'freshly attached note with low semantic overlap',
        embedding: [0, 1],
        similarity: 0.05,
        metadata: { documentId: 2, name: 'attachment.txt' },
      },
    ]);

    const { context, sourceDocuments, preferredSourceDocuments } =
      await buildMessageSources({
        userInput: 'what does the attachment say',
        attachmentSourceIds: [2],
        enabledSources: [1],
        sources: [
          source(1, 'library.pdf'),
          source(2, 'attachment.txt', 'attached overview snippet'),
        ],
        vectorStore,
        embeddings: null,
      });

    expect(context[0]).toContain(
      'Current Attachment Source: attachment.txt (Overview)'
    );
    expect(sourceDocuments[0].documentId).toBe(2);
    expect(preferredSourceDocuments.map((d) => d.documentId)).toEqual([2]);
    expect(new Set(sourceDocuments.map((d) => d.name))).toEqual(
      new Set(['attachment.txt', 'library.pdf'])
    );
  });

  it('still cites a freshly attached source that produced no retrieved chunk', async () => {
    const vectorStore = makeVectorStore([
      {
        id: '1:0',
        document: 'the only retrievable content is in the library file',
        embedding: [1, 0],
        similarity: 0.8,
        metadata: { documentId: 1, name: 'library.pdf' },
      },
    ]);

    const { context, sourceDocuments } = await buildMessageSources({
      userInput: 'summarize everything',
      attachmentSourceIds: [2],
      enabledSources: [1],
      sources: [
        source(1, 'library.pdf'),
        source(2, 'attachment.pdf', 'attachment overview only'),
      ],
      vectorStore,
      embeddings: null,
    });

    expect(sourceDocuments.map((d) => d.documentId)).toEqual([2, 1]);
    expect(context[0]).toContain('attachment.pdf (Overview)');
  });

  it('takes the attachment-only path when there is no user query', async () => {
    const vectorStore = makeVectorStore([]);

    const { context, sourceDocuments } = await buildMessageSources({
      userInput: '   ',
      attachmentSourceIds: [5],
      enabledSources: [],
      sources: [source(5, 'dropped.pdf', 'just attached, no question yet')],
      vectorStore,
      embeddings: null,
    });

    expect(vectorStore.query).not.toHaveBeenCalled();
    expect(sourceDocuments).toEqual([
      {
        documentId: 5,
        name: 'dropped.pdf',
        passage: 'just attached, no question yet',
      },
    ]);
    expect(context[0]).toContain('dropped.pdf (Overview)');
  });

  it('returns nothing and never touches retrieval when no sources are active', async () => {
    const vectorStore = makeVectorStore([]);

    const result = await buildMessageSources({
      userInput: 'anything',
      attachmentSourceIds: [],
      enabledSources: [],
      sources: [source(1, 'unused.pdf')],
      vectorStore,
      embeddings: null,
    });

    expect(result).toEqual({
      context: [],
      sourceDocuments: [],
      preferredSourceDocuments: [],
    });
    expect(vectorStore.query).not.toHaveBeenCalled();
  });

  it('never emits a citation whose block is absent from the context sent to the model', async () => {
    const vectorStore = makeVectorStore([
      {
        id: '1:0',
        document: 'vacation policy grants twenty six days of paid leave',
        embedding: [1, 0],
        similarity: 0.85,
        metadata: { documentId: 1, name: 'handbook.pdf' },
      },
      {
        id: '2:0',
        document: 'quarterly revenue reached five million dollars',
        embedding: [0, 1],
        similarity: 0.82,
        metadata: { documentId: 2, name: 'q4_report.pdf' },
      },
    ]);

    const { context, sourceDocuments, preferredSourceDocuments } =
      await buildMessageSources({
        userInput: 'how many vacation days do i get',
        attachmentSourceIds: [],
        enabledSources: [1, 2],
        sources: [source(1, 'handbook.pdf'), source(2, 'q4_report.pdf')],
        vectorStore,
        embeddings: null,
      });

    const answer =
      'You are granted twenty six days of paid vacation leave each year.';

    const byAnswer = pickCitationsByAnswer(
      sourceDocuments,
      answer,
      preferredSourceDocuments
    );
    const finalCitations = restrictCitationsToContext(
      byAnswer,
      context.join('\n'),
      preferredSourceDocuments
    );

    expect(finalCitations.map((d) => d.documentId)).toEqual([1]);
    const present = presentNames(context);
    for (const cited of finalCitations) {
      expect(present.has(cited.name)).toBe(true);
    }
  });
});
