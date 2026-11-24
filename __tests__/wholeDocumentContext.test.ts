import { buildMessageSources, type SourceRow } from '../utils/messageSources';
import * as keywordIndex from '../database/keywordIndex';
import {
  decideAutoWindow,
  type AutoWindowInput,
} from '../constants/auto-window';
import type { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';

jest.mock('../database/keywordIndex', () => ({
  keywordSearch: jest.fn().mockResolvedValue([]),
}));

const mockKeywordSearch = keywordIndex.keywordSearch as jest.Mock;

const DOCUMENT_ID = 5;
const ROOMY_BUDGET_TOKENS = 4000;
const TIGHT_BUDGET_TOKENS = 5;

const source: SourceRow = {
  id: DOCUMENT_ID,
  name: 'harbour.txt',
  firstChunk: 'overview of the harbour',
};

const chunkRows = [
  { id: `${DOCUMENT_ID}:2`, document: 'third topic: tides' },
  { id: `${DOCUMENT_ID}:0`, document: 'first topic: cranes' },
  { id: `${DOCUMENT_ID}:1`, document: 'second topic: ferries' },
];

const makeVectorStore = () => {
  const query = jest.fn().mockResolvedValue([]);
  const execute = jest.fn().mockResolvedValue({ rows: chunkRows });
  return {
    store: { query, db: { execute } } as unknown as OPSQLiteVectorStore,
    query,
    execute,
  };
};

const build = (
  store: OPSQLiteVectorStore,
  sourceTokenBudget: number | undefined,
  passWholeDocument = false
) =>
  buildMessageSources({
    userInput: 'list every topic in this document',
    attachmentSourceIds: [DOCUMENT_ID],
    enabledSources: [],
    sources: [source],
    vectorStore: store,
    sourceTokenBudget,
    passWholeDocument,
  });

const autoTurnPassesWholeDocument = (
  overrides: Partial<AutoWindowInput> = {}
) =>
  decideAutoWindow({
    memory: 'auto',
    thinking: false,
    deviceRamGB: 11.3,
    modelCapacityTokens: 8192,
    modelFitsDevice: true,
    documentAttached: true,
    documentTokens: 100,
    wholeDocumentBudgetTokens: ROOMY_BUDGET_TOKENS,
    ...overrides,
  }).reason === 'whole-document';

beforeEach(() => {
  mockKeywordSearch.mockResolvedValue([]);
});

describe('whole document when Auto raised the window for it', () => {
  it('puts the whole document in original order as one source block', async () => {
    const passWholeDocument = autoTurnPassesWholeDocument();
    const { store, query } = makeVectorStore();

    const built = await build(store, ROOMY_BUDGET_TOKENS, passWholeDocument);

    expect(query).not.toHaveBeenCalled();
    expect(built.context).toHaveLength(1);
    const block = built.context[0]!;
    expect(block).toContain('Source 1: harbour.txt');
    expect(block.indexOf('first topic')).toBeLessThan(
      block.indexOf('second topic')
    );
    expect(block.indexOf('second topic')).toBeLessThan(
      block.indexOf('third topic')
    );
  });

  it('keeps the source document shape with an ordinal and the full passage', async () => {
    const passWholeDocument = autoTurnPassesWholeDocument();
    const { store } = makeVectorStore();

    const built = await build(store, ROOMY_BUDGET_TOKENS, passWholeDocument);

    expect(built.sourceDocuments).toHaveLength(1);
    expect(built.sourceDocuments[0]).toMatchObject({
      documentId: DOCUMENT_ID,
      name: 'harbour.txt',
      ordinal: 1,
    });
    expect(built.sourceDocuments[0]!.passage).toContain('third topic');
  });

  it('falls back to retrieval when the document does not fit the budget', async () => {
    const passWholeDocument = autoTurnPassesWholeDocument();
    const { store, query } = makeVectorStore();

    const built = await build(store, TIGHT_BUDGET_TOKENS, passWholeDocument);

    expect(query).toHaveBeenCalled();
    expect(built.context.join('')).not.toContain('third topic');
  });

  it('falls back to retrieval when no source budget is supplied', async () => {
    const passWholeDocument = autoTurnPassesWholeDocument();
    const { store, query } = makeVectorStore();

    await build(store, undefined, passWholeDocument);

    expect(query).toHaveBeenCalled();
  });

  it('retrieves passages when Auto kept the window at 4096', async () => {
    const passWholeDocument = autoTurnPassesWholeDocument({
      documentTokens: ROOMY_BUDGET_TOKENS + 1,
    });
    const { store, query } = makeVectorStore();

    await build(store, ROOMY_BUDGET_TOKENS, passWholeDocument);

    expect(query).toHaveBeenCalled();
  });
});

describe('a turn whose window was not raised for the document', () => {
  it('retrieves passages whether or not a source budget is supplied', async () => {
    const { store, query, execute } = makeVectorStore();
    const withoutBudget = await build(store, undefined);
    query.mockClear();
    execute.mockClear();

    const withBudget = await build(store, ROOMY_BUDGET_TOKENS);

    expect(withBudget).toEqual(withoutBudget);
    expect(query).toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
});
