// __tests__/modelRepository.test.ts
import { type SQLiteDatabase } from 'expo-sqlite';
import {
  addModel,
  getAllModels,
  getModelsByNames,
  removeDelistedBuiltInModels,
  syncBuiltInModelPaths,
} from '../database/modelRepository';
import { DEFAULT_MODELS } from '../constants/default-models';

jest.mock('expo-sqlite', () => {
  const stableDb = {};
  return { useSQLiteContext: jest.fn(() => stableDb) };
});

type ModelReader = Pick<SQLiteDatabase, 'getAllAsync'>;

describe('vision flag', () => {
  it('maps vision INTEGER 1 to boolean true from DB row', async () => {
    const mockDb: ModelReader = {
      getAllAsync: jest.fn().mockResolvedValue([
        {
          id: 1,
          modelName: 'Test VLM',
          source: 'remote',
          isDownloaded: 1,
          modelPath: '',
          tokenizerPath: '',
          tokenizerConfigPath: '',
          featured: 0,
          thinking: 0,
          vision: 1,
          labels: null,
          parameters: null,
          modelSize: null,
        },
      ]),
    };

    const models = await getAllModels(mockDb);
    expect(models[0].vision).toBe(true);
  });

  it('maps vision INTEGER 0 to boolean false from DB row', async () => {
    const mockDb: ModelReader = {
      getAllAsync: jest.fn().mockResolvedValue([
        {
          id: 1,
          modelName: 'Text Model',
          source: 'remote',
          isDownloaded: 1,
          modelPath: '',
          tokenizerPath: '',
          tokenizerConfigPath: '',
          featured: 0,
          thinking: 0,
          vision: 0,
          labels: null,
          parameters: null,
          modelSize: null,
        },
      ]),
    };

    const models = await getAllModels(mockDb);
    expect(models[0].vision).toBe(false);
  });
});

describe('systemPrompt field', () => {
  it('maps systemPrompt string from DB row', async () => {
    const mockDb: ModelReader = {
      getAllAsync: jest.fn().mockResolvedValue([
        {
          id: 1,
          modelName: 'Bielik',
          source: 'remote',
          isDownloaded: 0,
          modelPath: '',
          tokenizerPath: '',
          tokenizerConfigPath: '',
          featured: 1,
          thinking: 0,
          vision: 0,
          labels: null,
          parameters: 1.5,
          modelSize: 1.65,
          systemPrompt: 'Polish prompt',
        },
      ]),
    };

    const models = await getAllModels(mockDb);
    expect(models[0].systemPrompt).toBe('Polish prompt');
  });

  it('maps null systemPrompt from DB row', async () => {
    const mockDb: ModelReader = {
      getAllAsync: jest.fn().mockResolvedValue([
        {
          id: 1,
          modelName: 'Qwen',
          source: 'remote',
          isDownloaded: 0,
          modelPath: '',
          tokenizerPath: '',
          tokenizerConfigPath: '',
          featured: 1,
          thinking: 0,
          vision: 0,
          labels: null,
          parameters: 0.75,
          modelSize: 0.94,
          systemPrompt: null,
        },
      ]),
    };

    const models = await getAllModels(mockDb);
    expect(models[0].systemPrompt).toBeNull();
  });
});

describe('getModelsByNames', () => {
  it('returns models in the requested order', async () => {
    const mockDb: ModelReader = {
      getAllAsync: jest.fn().mockResolvedValue([
        {
          id: 2,
          modelName: 'Qwen 3 - 1.7B',
          source: 'remote',
          isDownloaded: 0,
          modelPath: '',
          tokenizerPath: '',
          tokenizerConfigPath: '',
          featured: 1,
          experimental: 0,
          thinking: 1,
          vision: 0,
          labels: null,
          parameters: 2.03,
          modelSize: 2.16,
          systemPrompt: null,
        },
        {
          id: 1,
          modelName: 'LFM 2.5 - 1.2B',
          source: 'remote',
          isDownloaded: 0,
          modelPath: '',
          tokenizerPath: '',
          tokenizerConfigPath: '',
          featured: 1,
          experimental: 0,
          thinking: 0,
          vision: 0,
          labels: null,
          parameters: 1.2,
          modelSize: 1.14,
          systemPrompt: null,
        },
      ]),
    };

    const models = await getModelsByNames(mockDb, [
      'LFM 2.5 - 1.2B',
      'Qwen 3 - 1.7B',
    ]);

    expect(models.map((model) => model.modelName)).toEqual([
      'LFM 2.5 - 1.2B',
      'Qwen 3 - 1.7B',
    ]);
  });
});

describe('syncBuiltInModelPaths', () => {
  it('rewrites a built-in row with paths from DEFAULT_MODELS', async () => {
    const bielik = DEFAULT_MODELS.find((m) => m.modelName === 'Bielik - v3.0')!;
    const runAsync = jest.fn().mockResolvedValue({});
    const mockDb = { runAsync } as unknown as SQLiteDatabase;

    await syncBuiltInModelPaths(mockDb, 7, 'Bielik - v3.0');

    expect(runAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = runAsync.mock.calls[0];
    expect(sql).toContain(`source = 'built-in'`);
    expect(params).toEqual([
      bielik.modelPath,
      bielik.tokenizerPath,
      bielik.tokenizerConfigPath,
      bielik.modelSize,
      7,
    ]);
  });

  it('does nothing for a model name outside DEFAULT_MODELS', async () => {
    const runAsync = jest.fn();
    const mockDb = { runAsync } as unknown as SQLiteDatabase;

    await syncBuiltInModelPaths(mockDb, 3, 'My Local Model');

    expect(runAsync).not.toHaveBeenCalled();
  });
});

describe('built-in model paths', () => {
  const catalogModel = DEFAULT_MODELS[0];
  const storedRow = (isDownloaded: number) => ({
    id: 1,
    modelName: catalogModel.modelName,
    source: 'built-in',
    isDownloaded,
    modelPath: 'https://example.com/v1/model.pte',
    tokenizerPath: 'https://example.com/v1/tokenizer.json',
    tokenizerConfigPath: 'https://example.com/v1/tokenizer_config.json',
    featured: 0,
    thinking: 0,
    vision: 0,
    labels: null,
    parameters: null,
    modelSize: null,
  });

  it('keeps the URLs a downloaded model was fetched from, since they name its files on disk', async () => {
    const mockDb: ModelReader = {
      getAllAsync: jest.fn().mockResolvedValue([storedRow(1)]),
    };

    const [model] = await getAllModels(mockDb);

    expect(model.modelPath).toBe('https://example.com/v1/model.pte');
    expect(model.tokenizerPath).toBe('https://example.com/v1/tokenizer.json');
    expect(model.tokenizerConfigPath).toBe(
      'https://example.com/v1/tokenizer_config.json'
    );
  });

  it('points a model that is not downloaded at the current catalog URLs', async () => {
    const mockDb: ModelReader = {
      getAllAsync: jest.fn().mockResolvedValue([storedRow(0)]),
    };

    const [model] = await getAllModels(mockDb);

    expect(model.modelPath).toBe(catalogModel.modelPath);
    expect(model.tokenizerPath).toBe(catalogModel.tokenizerPath);
    expect(model.tokenizerConfigPath).toBe(catalogModel.tokenizerConfigPath);
  });
});

describe('removeDelistedBuiltInModels', () => {
  it('keeps a downloaded model the catalog no longer lists, so its chats and files stay reachable', async () => {
    const runAsync = jest.fn().mockResolvedValue(undefined);

    await removeDelistedBuiltInModels({ runAsync } as never, ['Qwen 3 - 1.7B']);

    const [sql, params] = runAsync.mock.calls[0];
    expect(sql).toMatch(/source = 'built-in'/);
    expect(sql).toMatch(/isDownloaded = 0/);
    expect(params).toEqual(['Qwen 3 - 1.7B']);
  });
});

describe('addModel', () => {
  const model = {
    modelName: 'model',
    isDownloaded: false,
    source: 'remote' as const,
    modelPath: 'https://example.com/model.pte',
    tokenizerPath: 'https://example.com/tokenizer.json',
    tokenizerConfigPath: 'https://example.com/tokenizer_config.json',
  };

  it('returns no id when the insert was ignored, not the id of an earlier row', async () => {
    const runAsync = jest
      .fn()
      .mockResolvedValue({ changes: 0, lastInsertRowId: 5 });
    const db = { runAsync } as unknown as SQLiteDatabase;

    expect(await addModel(db, model)).toBe(0);
  });

  it('returns the new id when the row was stored', async () => {
    const runAsync = jest
      .fn()
      .mockResolvedValue({ changes: 1, lastInsertRowId: 6 });
    const db = { runAsync } as unknown as SQLiteDatabase;

    expect(await addModel(db, model)).toBe(6);
  });
});
