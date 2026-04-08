// __tests__/modelRepository.test.ts
import { getAllModels, addModel } from '../database/modelRepository';

jest.mock('expo-sqlite', () => {
  const stableDb = {};
  return { useSQLiteContext: jest.fn(() => stableDb) };
});

describe('vision flag', () => {
  it('maps vision INTEGER 1 to boolean true from DB row', async () => {
    const mockDb = {
      getAllAsync: jest.fn().mockResolvedValue([
        {
          id: 1, modelName: 'Test VLM', source: 'remote', isDownloaded: 1,
          modelPath: '', tokenizerPath: '', tokenizerConfigPath: '',
          featured: 0, thinking: 0, vision: 1, labels: null,
          parameters: null, modelSize: null,
        },
      ]),
    } as any;

    const models = await getAllModels(mockDb);
    expect(models[0].vision).toBe(true);
  });

  it('maps vision INTEGER 0 to boolean false from DB row', async () => {
    const mockDb = {
      getAllAsync: jest.fn().mockResolvedValue([
        {
          id: 1, modelName: 'Text Model', source: 'remote', isDownloaded: 1,
          modelPath: '', tokenizerPath: '', tokenizerConfigPath: '',
          featured: 0, thinking: 0, vision: 0, labels: null,
          parameters: null, modelSize: null,
        },
      ]),
    } as any;

    const models = await getAllModels(mockDb);
    expect(models[0].vision).toBe(false);
  });
});

describe('systemPrompt field', () => {
  it('maps systemPrompt string from DB row', async () => {
    const mockDb = {
      getAllAsync: jest.fn().mockResolvedValue([
        {
          id: 1, modelName: 'Bielik', source: 'remote', isDownloaded: 0,
          modelPath: '', tokenizerPath: '', tokenizerConfigPath: '',
          featured: 1, thinking: 0, vision: 0, labels: null,
          parameters: 1.5, modelSize: 1.65, systemPrompt: 'Polish prompt',
        },
      ]),
    } as any;

    const models = await getAllModels(mockDb);
    expect(models[0].systemPrompt).toBe('Polish prompt');
  });

  it('maps null systemPrompt from DB row', async () => {
    const mockDb = {
      getAllAsync: jest.fn().mockResolvedValue([
        {
          id: 1, modelName: 'Qwen', source: 'remote', isDownloaded: 0,
          modelPath: '', tokenizerPath: '', tokenizerConfigPath: '',
          featured: 1, thinking: 0, vision: 0, labels: null,
          parameters: 0.75, modelSize: 0.94, systemPrompt: null,
        },
      ]),
    } as any;

    const models = await getAllModels(mockDb);
    expect(models[0].systemPrompt).toBeNull();
  });
});
