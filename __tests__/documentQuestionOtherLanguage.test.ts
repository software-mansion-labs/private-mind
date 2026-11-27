import { buildMessageSources, type SourceRow } from '../utils/messageSources';
import * as keywordIndex from '../database/keywordIndex';
import type { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import type { LFMEmbeddings } from '../utils/lfmEmbeddings';

jest.mock('../database/keywordIndex', () => ({
  keywordSearch: jest.fn().mockResolvedValue([]),
}));

const mockKeywordSearch = keywordIndex.keywordSearch as jest.Mock;

const DOCUMENT_ID = 7;
const ROOMY_BUDGET_TOKENS = 1500;
const TIGHT_BUDGET_TOKENS = 20;
const CROSS_LANGUAGE_SIMILARITY = 0.2;

const MEMO = [
  'Harbor Lane Library — renovation memo',
  'The renovation of the Harbor Lane Library runs under the project codename Blue Heron.',
  'The project manager is Marta Wilk, who reports to the city council every second Thursday.',
  'The reading room closes on 3 March and reopens on 21 April.',
].join('\n');

const POLISH_QUESTION =
  'Kto jest kierownikiem projektu i kiedy czytelnia zostanie ponownie otwarta?';

const memo: SourceRow = {
  id: DOCUMENT_ID,
  name: 'harbor-lane-memo.txt',
  firstChunk: MEMO,
};

const makeVectorStore = () =>
  ({
    query: jest.fn().mockResolvedValue([
      {
        id: `${DOCUMENT_ID}:0`,
        document: MEMO,
        embedding: [1, 0],
        similarity: CROSS_LANGUAGE_SIMILARITY,
        metadata: { documentId: DOCUMENT_ID, name: memo.name },
      },
    ]),
    db: {
      execute: jest.fn().mockImplementation(async (sql: string) => ({
        rows: sql.includes('id >= ?')
          ? [{ id: `${DOCUMENT_ID}:0`, document: MEMO }]
          : [],
      })),
    },
  }) as unknown as OPSQLiteVectorStore;

const embeddings = {
  embedQuery: jest.fn().mockResolvedValue([1, 0]),
} as unknown as LFMEmbeddings;

const askFollowUp = (userInput: string, sourceTokenBudget?: number) =>
  buildMessageSources({
    userInput,
    attachmentSourceIds: [],
    enabledSources: [DOCUMENT_ID],
    sources: [memo],
    vectorStore: makeVectorStore(),
    embeddings,
    sourceTokenBudget,
  });

beforeEach(() => {
  mockKeywordSearch.mockResolvedValue([]);
});

describe('a follow-up about an enabled document whose passages miss every retrieval gate', () => {
  it('passes the whole document when the question is in another language than the document', async () => {
    const built = await askFollowUp(POLISH_QUESTION, ROOMY_BUDGET_TOKENS);

    expect(built.context.join('')).toContain('Marta Wilk');
    expect(built.sourceDocuments).toHaveLength(1);
    expect(built.sourceDocuments[0]).toMatchObject({
      documentId: DOCUMENT_ID,
      name: memo.name,
    });
  });

  it('passes nothing when the question is in the document’s language', async () => {
    const built = await askFollowUp(
      'Why do leaves change colour in autumn?',
      ROOMY_BUDGET_TOKENS
    );

    expect(built.context).toEqual([]);
  });

  it('passes nothing when the document does not fit the turn’s source room', async () => {
    const built = await askFollowUp(POLISH_QUESTION, TIGHT_BUDGET_TOKENS);

    expect(built.context).toEqual([]);
  });

  it('passes nothing when the turn carries no source budget', async () => {
    const built = await askFollowUp(POLISH_QUESTION);

    expect(built.context).toEqual([]);
  });
});
