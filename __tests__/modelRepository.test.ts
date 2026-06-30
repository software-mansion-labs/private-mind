// __tests__/modelRepository.test.ts
import { type SQLiteDatabase } from 'expo-sqlite';
import { getAllModels, getModelsByNames } from '../database/modelRepository';

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
