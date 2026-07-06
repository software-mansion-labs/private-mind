import type { SQLiteDatabase } from 'expo-sqlite';
import { migrateLegacyVectorStore } from '../database/vectorStoreMigration';

const makeDb = (opts: {
  hasLegacyVectorsTable: boolean;
  documentColumnMissing?: boolean;
}) => {
  const getFirstAsync: jest.Mock = jest.fn(async (sql: string) => {
    if (sql.includes('sqlite_master')) {
      return opts.hasLegacyVectorsTable ? { 1: 1 } : null;
    }
    return null;
  });
  const execAsync: jest.Mock = jest.fn(async (sql: string) => {
    if (sql.includes('SELECT document FROM vectors') && opts.documentColumnMissing) {
      throw new Error('no such column: document');
    }
  });
  const runAsync: jest.Mock = jest.fn(async () => ({}));

  return {
    db: {
      getFirstAsync,
      execAsync,
      runAsync,
    } as Partial<SQLiteDatabase> as SQLiteDatabase,
    getFirstAsync,
    execAsync,
    runAsync,
  };
};

const deleteCalls = (runAsync: jest.Mock): string[] =>
  runAsync.mock.calls.map((call) => call[0] as string);

describe('migrateLegacyVectorStore', () => {
  it('does NOT wipe sources when no legacy vectors table exists (current dual-db setup)', async () => {
    const { db, execAsync, runAsync } = makeDb({ hasLegacyVectorsTable: false });

    await migrateLegacyVectorStore(db);

    expect(execAsync).not.toHaveBeenCalled();
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('wipes the legacy vectors table and orphaned sources when the table lacks a document column', async () => {
    const { db, runAsync } = makeDb({
      hasLegacyVectorsTable: true,
      documentColumnMissing: true,
    });

    await migrateLegacyVectorStore(db);

    const calls = deleteCalls(runAsync);
    expect(calls.some((sql) => /DELETE FROM chatSources/.test(sql))).toBe(true);
    expect(calls.some((sql) => /DELETE FROM sources/.test(sql))).toBe(true);
  });

  it('leaves data intact when a legacy vectors table already has the document column', async () => {
    const { db, runAsync } = makeDb({
      hasLegacyVectorsTable: true,
      documentColumnMissing: false,
    });

    await migrateLegacyVectorStore(db);

    expect(runAsync).not.toHaveBeenCalled();
  });
});
