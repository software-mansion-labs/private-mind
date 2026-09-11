import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_MODELS } from '../constants/default-models';
import { MODEL_CATALOG_CACHE_KEY } from '../constants/modelCatalog';
import { resolveModelCatalog } from '../utils/fetchModelCatalog';

const VALID_MANIFEST = {
  schemaVersion: 1,
  models: [
    {
      modelName: 'Remote Model',
      modelPath: 'https://example.com/model.pte',
      tokenizerPath: 'https://example.com/tokenizer.json',
      tokenizerConfigPath: 'https://example.com/tokenizer_config.json',
      modelSize: 1.2,
    },
  ],
};

const mockFetchOnce = (impl: () => Promise<Partial<Response>>) => {
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(impl);
};

describe('resolveModelCatalog', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns the remote manifest and caches it on success', async () => {
    mockFetchOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(VALID_MANIFEST)),
      })
    );

    const result = await resolveModelCatalog();

    expect(result.origin).toBe('remote');
    expect(result.models).toEqual([
      {
        modelName: 'Remote Model',
        modelPath: 'https://example.com/model.pte',
        tokenizerPath: 'https://example.com/tokenizer.json',
        tokenizerConfigPath: 'https://example.com/tokenizer_config.json',
        modelSize: 1.2,
        source: 'remote',
      },
    ]);
    expect(await AsyncStorage.getItem(MODEL_CATALOG_CACHE_KEY)).toBe(
      JSON.stringify(VALID_MANIFEST)
    );
  });

  it('falls back to the cache when the network fails', async () => {
    await AsyncStorage.setItem(
      MODEL_CATALOG_CACHE_KEY,
      JSON.stringify(VALID_MANIFEST)
    );
    mockFetchOnce(() => Promise.reject(new Error('network down')));

    const result = await resolveModelCatalog();

    expect(result.origin).toBe('cache');
    expect(result.models[0].modelName).toBe('Remote Model');
  });

  it('falls back to the cache when the response is not ok', async () => {
    await AsyncStorage.setItem(
      MODEL_CATALOG_CACHE_KEY,
      JSON.stringify(VALID_MANIFEST)
    );
    mockFetchOnce(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve(''),
      })
    );

    const result = await resolveModelCatalog();

    expect(result.origin).toBe('cache');
  });

  it('falls back to the cache when the payload fails schema validation', async () => {
    await AsyncStorage.setItem(
      MODEL_CATALOG_CACHE_KEY,
      JSON.stringify(VALID_MANIFEST)
    );
    mockFetchOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ not: 'a manifest' })),
      })
    );

    const result = await resolveModelCatalog();

    expect(result.origin).toBe('cache');
  });

  it('falls back to the cache when the payload is malformed JSON', async () => {
    await AsyncStorage.setItem(
      MODEL_CATALOG_CACHE_KEY,
      JSON.stringify(VALID_MANIFEST)
    );
    mockFetchOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{not valid json'),
      })
    );

    const result = await resolveModelCatalog();

    expect(result.origin).toBe('cache');
  });

  it('falls back to DEFAULT_MODELS when both the network and the cache fail', async () => {
    mockFetchOnce(() => Promise.reject(new Error('network down')));

    const result = await resolveModelCatalog();

    expect(result.origin).toBe('fallback');
    expect(result.models).toBe(DEFAULT_MODELS);
  });

  it('falls back to DEFAULT_MODELS when the cached payload is corrupt', async () => {
    await AsyncStorage.setItem(MODEL_CATALOG_CACHE_KEY, '{not valid json');
    mockFetchOnce(() => Promise.reject(new Error('network down')));

    const result = await resolveModelCatalog();

    expect(result.origin).toBe('fallback');
  });

  it('never throws, even when fetch itself is unavailable', async () => {
    (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(() => {
      throw new Error('fetch is not defined');
    });

    await expect(resolveModelCatalog()).resolves.toEqual(
      expect.objectContaining({ origin: 'fallback' })
    );
  });
});
