import type { SQLiteDatabase } from 'expo-sqlite';

jest.mock('../store/chatStore', () => ({
  useChatStore: { getState: () => ({}) },
}));
jest.mock('../store/llmStore', () => ({
  useLLMStore: { getState: () => ({}) },
}));
jest.mock('../store/modelStore', () => ({
  useModelStore: { getState: () => ({}) },
}));
jest.mock('../store/sourceStore', () => ({
  useSourceStore: { getState: () => ({}) },
}));
jest.mock('../database/modelRepository', () => ({ addModel: jest.fn() }));
jest.mock('../utils/sourceLinkingBoundary', () => ({
  initSourceLinkingBoundary: jest.fn(),
}));
jest.mock('../constants/default-models', () => ({ DEFAULT_MODELS: [] }));

import { runMigrations } from '../database/db';

type Schema = Record<string, string[]>;

const oldSchema = (): Schema => ({
  models: ['id', 'name', 'source'],
  messages: ['id', 'chatId', 'content', 'role'],
  chatSettings: ['id', 'chatId', 'contextWindow'],
  sources: ['id', 'name'],
  chats: ['id', 'title'],
  benchmarks: ['id'],
  chatSources: ['chatId', 'sourceId'],
});

class FakeDb {
  tables: Schema;
  alterLog: string[] = [];
  failOn: ((sql: string) => boolean) | null = null;

  constructor(schema: Schema) {
    this.tables = schema;
  }

  getAllAsync = async (sql: string) => {
    const match = /PRAGMA table_info\((\w+)\)/.exec(sql);
    if (match) return (this.tables[match[1]] ?? []).map((name) => ({ name }));
    return [];
  };

  execAsync = async (sql: string) => {
    if (this.failOn?.(sql)) throw new Error('simulated migration failure');

    const add = /ALTER TABLE (\w+) ADD COLUMN (\w+)/.exec(sql);
    if (add) {
      const [, table, column] = add;
      this.alterLog.push(sql);
      if ((this.tables[table] ?? []).includes(column)) {
        throw new Error(`duplicate column name: ${column}`);
      }
      this.tables[table] = [...(this.tables[table] ?? []), column];
      return;
    }

    const drop = /ALTER TABLE (\w+) DROP COLUMN (\w+)/.exec(sql);
    if (drop) {
      const [, table, column] = drop;
      this.alterLog.push(sql);
      this.tables[table] = (this.tables[table] ?? []).filter(
        (name) => name !== column
      );
    }
  };

  getFirstAsync = async () => null;
  runAsync = async () => ({});
  withTransactionAsync = async (fn: () => Promise<void>) => fn();

  asDb() {
    return this as unknown as SQLiteDatabase;
  }
}

const has = (db: FakeDb, table: string, column: string) =>
  (db.tables[table] ?? []).includes(column);

describe('runMigrations from a real old (pre-RAG) schema', () => {
  it('adds every missing column onto the old schema', async () => {
    const db = new FakeDb(oldSchema());

    await runMigrations(db.asDb());

    for (const column of [
      'featured',
      'experimental',
      'family',
      'thinking',
      'labels',
      'vision',
      'systemPrompt',
    ]) {
      expect(has(db, 'models', column)).toBe(true);
    }
    expect(has(db, 'messages', 'imagePath')).toBe(true);
    expect(has(db, 'messages', 'documentName')).toBe(true);
    expect(has(db, 'messages', 'sourceDocuments')).toBe(true);
    expect(has(db, 'chatSettings', 'thinkingEnabled')).toBe(true);
    expect(has(db, 'sources', 'firstChunk')).toBe(true);
  });

  it('drops contextWindow only when it is present', async () => {
    const withColumn = new FakeDb(oldSchema());
    await runMigrations(withColumn.asDb());
    expect(has(withColumn, 'chatSettings', 'contextWindow')).toBe(false);
    expect(withColumn.alterLog.some((sql) => sql.includes('DROP COLUMN'))).toBe(
      true
    );

    const withoutColumn = new FakeDb({
      ...oldSchema(),
      chatSettings: ['id', 'chatId'],
    });
    await runMigrations(withoutColumn.asDb());
    expect(
      withoutColumn.alterLog.some((sql) => sql.includes('DROP COLUMN'))
    ).toBe(false);
  });

  it('is idempotent: a second run alters nothing and does not throw', async () => {
    const db = new FakeDb(oldSchema());
    await runMigrations(db.asDb());
    db.alterLog.length = 0;

    await expect(runMigrations(db.asDb())).resolves.toBeUndefined();
    expect(db.alterLog).toEqual([]);
  });

  it('is already-migrated safe: running on a fresh full schema is a no-op', async () => {
    const db = new FakeDb({
      models: [
        'id',
        'name',
        'source',
        'featured',
        'experimental',
        'family',
        'thinking',
        'labels',
        'vision',
        'systemPrompt',
      ],
      messages: [
        'id',
        'chatId',
        'content',
        'role',
        'imagePath',
        'documentName',
        'sourceDocuments',
      ],
      chatSettings: ['id', 'chatId', 'thinkingEnabled'],
      sources: ['id', 'name', 'firstChunk'],
    });

    await runMigrations(db.asDb());
    expect(db.alterLog).toEqual([]);
  });

  it('is not atomic but recovers: a mid-migration failure is completed by a re-run', async () => {
    const db = new FakeDb(oldSchema());
    db.failOn = (sql) => sql.includes('ADD COLUMN sourceDocuments');

    await expect(runMigrations(db.asDb())).rejects.toThrow(
      'simulated migration failure'
    );

    expect(has(db, 'models', 'featured')).toBe(true);
    expect(has(db, 'messages', 'imagePath')).toBe(true);
    expect(has(db, 'messages', 'documentName')).toBe(true);
    expect(has(db, 'messages', 'sourceDocuments')).toBe(false);
    expect(has(db, 'sources', 'firstChunk')).toBe(false);

    db.failOn = null;
    await expect(runMigrations(db.asDb())).resolves.toBeUndefined();
    expect(has(db, 'messages', 'sourceDocuments')).toBe(true);
    expect(has(db, 'sources', 'firstChunk')).toBe(true);
  });
});
