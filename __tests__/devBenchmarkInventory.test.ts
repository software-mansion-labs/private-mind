import type { Model } from '../database/modelRepository';
import {
  benchmarkableModels,
  bytesNeededToDownload,
  noRoomToDownload,
} from '../utils/devBenchmark/inventory';

const GB = 1024 ** 3;

const model = (overrides: Partial<Model>): Model => ({
  id: 1,
  modelName: 'Model',
  source: 'built-in',
  isDownloaded: false,
  modelPath: 'https://example.com/model.pte',
  tokenizerPath: 'https://example.com/tokenizer.json',
  tokenizerConfigPath: 'https://example.com/tokenizer_config.json',
  ...overrides,
});

describe('benchmarkableModels', () => {
  it('keeps the models the app lets this device run, smallest first', () => {
    const models = [
      model({ id: 1, modelName: 'Llama 3B', modelSize: 2.5 }),
      model({ id: 2, modelName: 'Qwen 0.6B', modelSize: 0.6 }),
      model({ id: 3, modelName: 'Huge 30B', modelSize: 20 }),
      model({ id: 4, modelName: 'Gemma 1B', modelSize: 1.2 }),
    ];

    expect(
      benchmarkableModels(models, (candidate) => candidate.modelSize! < 10).map(
        (candidate) => candidate.modelName
      )
    ).toEqual(['Qwen 0.6B', 'Gemma 1B', 'Llama 3B']);
  });

  it('uses the app memory gate by default', () => {
    const models = [
      model({ id: 1, modelName: 'Small', modelSize: 0.6 }),
      model({ id: 2, modelName: 'Too big for 8 GB', modelSize: 40 }),
    ];

    expect(benchmarkableModels(models).map((m) => m.modelName)).toEqual([
      'Small',
    ]);
  });

  it('leaves out a local model whose files are gone, keeping remote ones', () => {
    const models = [
      model({ id: 1, modelName: 'Local missing', source: 'local' }),
      model({
        id: 2,
        modelName: 'Local present',
        source: 'local',
        isDownloaded: true,
      }),
      model({ id: 3, modelName: 'Remote', source: 'remote' }),
    ];

    expect(
      benchmarkableModels(models, () => true).map((m) => m.modelName)
    ).toEqual(['Local present', 'Remote']);
  });

  it('ranks by parameters when the size is unknown, then by name', () => {
    const models = [
      model({ id: 1, modelName: 'B unknown' }),
      model({ id: 2, modelName: 'A unknown' }),
      model({ id: 3, modelName: 'Params', parameters: 1.7 }),
    ];

    expect(
      benchmarkableModels(models, () => true).map((m) => m.modelName)
    ).toEqual(['Params', 'A unknown', 'B unknown']);
  });
});

describe('free space before a download', () => {
  it('asks for the model size with a margin and a reserve', () => {
    expect(bytesNeededToDownload(model({ modelSize: 2 }))).toBeCloseTo(
      2 * GB * 1.1 + GB
    );
    expect(bytesNeededToDownload(model({}))).toBeNull();
  });

  it('explains a model that will not fit', () => {
    expect(noRoomToDownload(model({ modelSize: 4 }), 2 * GB)).toBe(
      'needs 5.4 GB free, 2.0 GB left'
    );
  });

  it('lets a model through when it fits or its size is unknown', () => {
    expect(noRoomToDownload(model({ modelSize: 1 }), 10 * GB)).toBeNull();
    expect(noRoomToDownload(model({}), 0)).toBeNull();
  });
});
