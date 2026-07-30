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
jest.mock('../constants/default-models', () => ({
  DEFAULT_MODELS: [
    {
      modelName: 'Bielik - v3.0',
      family: 'Bielik',
      modelPath: 'https://hf.example/resolve/v0.9.0/xnnpack/bielik.pte',
      tokenizerPath: 'https://hf.example/resolve/v0.9.0/tokenizer.json',
      tokenizerConfigPath:
        'https://hf.example/resolve/v0.9.0/tokenizer_config.json',
      source: 'remote',
      modelSize: 0.86,
      featured: true,
    },
  ],
}));

import { runMigrations } from '../database/db';

type Call = { sql: string; params: unknown[] };

const makeFakeDb = () => {
  const calls: Call[] = [];
  const db = {
    getAllAsync: async () => [],
    execAsync: async () => {},
    getFirstAsync: async () => null,
    runAsync: async (sql: string, ...params: unknown[]) => {
      calls.push({ sql, params: params.flat() });
      return {};
    },
    withTransactionAsync: async (fn: () => Promise<void>) => fn(),
  };
  return { db: db as unknown as SQLiteDatabase, calls };
};

describe('runMigrations built-in model path refresh', () => {
  it('rewrites stale download paths for undownloaded built-in models', async () => {
    const { db, calls } = makeFakeDb();

    await runMigrations(db);

    const refresh = calls.find((c) => c.sql.includes('SET modelPath'));
    expect(refresh).toBeDefined();
    expect(refresh!.sql).toContain(`source = 'built-in'`);
    expect(refresh!.sql).toContain('isDownloaded = 0');
    expect(refresh!.params).toEqual([
      'https://hf.example/resolve/v0.9.0/xnnpack/bielik.pte',
      'https://hf.example/resolve/v0.9.0/tokenizer.json',
      'https://hf.example/resolve/v0.9.0/tokenizer_config.json',
      0.86,
      'Bielik - v3.0',
    ]);
  });
});
