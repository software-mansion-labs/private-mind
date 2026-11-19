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
jest.mock('../database/catalogSync', () => ({
  updateCatalogRows: jest.fn(),
  insertCatalogModels: jest.fn(),
  applyCatalogWhenItArrives: jest.fn(),
}));

import { runMigrations } from '../database/db';

const QLORA = {
  id: 7,
  modelName: 'LLaMA 3.2 - 1B - QLoRa',
  modelPath: 'https://hf.example/v0.8.0/qlora.pte',
  tokenizerPath: 'https://hf.example/v0.8.0/qlora-tokenizer.json',
  tokenizerConfigPath: 'https://hf.example/shared/tokenizer_config.json',
};

const fakeDb = (rows: (typeof QLORA)[]) => {
  const runs: { sql: string; params: unknown[] }[] = [];
  const db = {
    getAllAsync: async (sql: string) => {
      if (sql.includes('PRAGMA table_info')) return [];
      if (sql.includes('isDownloaded = 1')) return rows;
      if (sql.includes('WHERE id NOT IN'))
        return [
          {
            modelPath: 'https://hf.example/v0.11.0/spinquant.pte',
            tokenizerPath: 'https://hf.example/v0.11.0/tokenizer.json',
            tokenizerConfigPath: QLORA.tokenizerConfigPath,
          },
        ];
      return [];
    },
    getFirstAsync: async (sql: string) =>
      sql.includes('modelName = ?') ? { id: 8 } : null,
    runAsync: async (sql: string, ...params: unknown[]) => {
      runs.push({ sql, params: params.flat() });
      return {};
    },
    execAsync: async () => {},
    withTransactionAsync: async (fn: () => Promise<void>) => fn(),
  };
  return { db: db as unknown as SQLiteDatabase, runs };
};

describe('a downloaded model the catalog retired, on the first start of the new version', () => {
  it('moves its chats to the replacement before the model row is deleted', async () => {
    const { db, runs } = fakeDb([QLORA]);

    await runMigrations(db);

    const move = runs.findIndex((r) => r.sql.includes('UPDATE chats'));
    const remove = runs.findIndex(
      (r) => r.sql.includes('DELETE FROM models') && r.sql.includes('NOT IN')
    );
    expect(runs[move].params).toEqual([8, 7]);
    expect(move).toBeLessThan(remove);
  });

  it('hands back only the files no other model still uses', async () => {
    const { db } = fakeDb([QLORA]);

    const retired = await runMigrations(db);

    expect(retired).toEqual([
      {
        modelName: 'LLaMA 3.2 - 1B - QLoRa',
        replacement: 'LLaMA 3.2 - 1B - SpinQuant',
        sources: [QLORA.modelPath, QLORA.tokenizerPath],
      },
    ]);
  });

  it('touches no chats when nothing retired was downloaded', async () => {
    const { db, runs } = fakeDb([]);

    expect(await runMigrations(db)).toEqual([]);
    expect(runs.some((r) => r.sql.includes('UPDATE chats'))).toBe(false);
  });
});
