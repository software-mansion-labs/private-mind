import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_MODELS } from '../constants/default-models';
import {
  MODEL_CATALOG_CACHE_KEY,
  MODEL_CATALOG_STARTUP_WAIT_MS,
} from '../constants/modelCatalog';
import { resolveModelCatalog } from '../utils/fetchModelCatalog';

const VALID_MANIFEST = {
  schemaVersion: 2,
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

const GATED_MANIFEST = {
  schemaVersion: 2,
  models: [
    ...VALID_MANIFEST.models,
    {
      modelName: 'Newer Model',
      modelPath: 'https://example.com/newer.pte',
      tokenizerPath: 'https://example.com/tokenizer.json',
      tokenizerConfigPath: 'https://example.com/tokenizer_config.json',
      minAppVersion: '1.3.5',
    },
  ],
};

describe('resolveModelCatalog', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('drops an entry that needs a newer app than the one running', async () => {
    mockFetchOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(GATED_MANIFEST)),
      })
    );

    const result = await resolveModelCatalog({ appVersion: '1.3.4' });

    expect(result.models.map((m) => m.modelName)).toEqual(['Remote Model']);
  });

  it('keeps an entry whose minimum app version the running app meets', async () => {
    mockFetchOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(GATED_MANIFEST)),
      })
    );

    const result = await resolveModelCatalog({ appVersion: '1.3.5' });

    expect(result.models.map((m) => m.modelName)).toEqual([
      'Remote Model',
      'Newer Model',
    ]);
  });

  it('applies the gate to the cached manifest as well', async () => {
    await AsyncStorage.setItem(
      MODEL_CATALOG_CACHE_KEY,
      JSON.stringify(GATED_MANIFEST)
    );
    mockFetchOnce(() => Promise.reject(new Error('network down')));

    const result = await resolveModelCatalog({ appVersion: '1.3.4' });

    expect(result.origin).toBe('cache');
    expect(result.models.map((m) => m.modelName)).toEqual(['Remote Model']);
  });

  it('rejects a manifest of the previous schema version', async () => {
    mockFetchOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({ ...VALID_MANIFEST, schemaVersion: 1 })
          ),
      })
    );

    const result = await resolveModelCatalog({ appVersion: '1.3.5' });

    expect(result.origin).toBe('fallback');
  });

  it('returns the remote manifest and caches it on success', async () => {
    mockFetchOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(VALID_MANIFEST)),
      })
    );

    const result = await resolveModelCatalog({ appVersion: '1.3.5' });

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

    const result = await resolveModelCatalog({ appVersion: '1.3.5' });

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

    const result = await resolveModelCatalog({ appVersion: '1.3.5' });

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

    const result = await resolveModelCatalog({ appVersion: '1.3.5' });

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

    const result = await resolveModelCatalog({ appVersion: '1.3.5' });

    expect(result.origin).toBe('cache');
  });

  it('falls back to DEFAULT_MODELS when both the network and the cache fail', async () => {
    mockFetchOnce(() => Promise.reject(new Error('network down')));

    const result = await resolveModelCatalog({ appVersion: '1.3.5' });

    expect(result.origin).toBe('fallback');
    expect(result.models).toBe(DEFAULT_MODELS);
  });

  it('falls back to DEFAULT_MODELS when the cached payload is corrupt', async () => {
    await AsyncStorage.setItem(MODEL_CATALOG_CACHE_KEY, '{not valid json');
    mockFetchOnce(() => Promise.reject(new Error('network down')));

    const result = await resolveModelCatalog({ appVersion: '1.3.5' });

    expect(result.origin).toBe('fallback');
  });

  it('never throws, even when fetch itself is unavailable', async () => {
    (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(() => {
      throw new Error('fetch is not defined');
    });

    await expect(resolveModelCatalog({ appVersion: '1.3.5' })).resolves.toEqual(
      expect.objectContaining({ origin: 'fallback' })
    );
  });

  describe('when the network is slow at startup', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('does not hold the start of the app for a slow answer: it starts from the cache and still caches the answer', async () => {
      await AsyncStorage.setItem(
        MODEL_CATALOG_CACHE_KEY,
        JSON.stringify({
          ...VALID_MANIFEST,
          models: [{ ...VALID_MANIFEST.models[0], modelName: 'Cached Model' }],
        })
      );
      let answer!: () => void;
      mockFetchOnce(
        () =>
          new Promise((resolve) => {
            answer = () =>
              resolve({
                ok: true,
                status: 200,
                text: () => Promise.resolve(JSON.stringify(VALID_MANIFEST)),
              });
          })
      );

      const pending = resolveModelCatalog();
      await jest.advanceTimersByTimeAsync(MODEL_CATALOG_STARTUP_WAIT_MS);
      const result = await pending;

      expect(result.origin).toBe('cache');
      expect(result.models[0].modelName).toBe('Cached Model');

      answer();
      await jest.advanceTimersByTimeAsync(10);
      expect(await AsyncStorage.getItem(MODEL_CATALOG_CACHE_KEY)).toBe(
        JSON.stringify(VALID_MANIFEST)
      );
    });

    it('starts from the cache without waiting at all, even when the network would have answered in time', async () => {
      await AsyncStorage.setItem(
        MODEL_CATALOG_CACHE_KEY,
        JSON.stringify({
          ...VALID_MANIFEST,
          models: [{ ...VALID_MANIFEST.models[0], modelName: 'Cached Model' }],
        })
      );
      let answer!: () => void;
      mockFetchOnce(
        () =>
          new Promise((resolve) => {
            answer = () =>
              resolve({
                ok: true,
                status: 200,
                text: () => Promise.resolve(JSON.stringify(VALID_MANIFEST)),
              });
          })
      );

      const result = await resolveModelCatalog();

      expect(result.origin).toBe('cache');
      expect(result.models[0].modelName).toBe('Cached Model');
      answer();
      await jest.advanceTimersByTimeAsync(10);
      expect(await AsyncStorage.getItem(MODEL_CATALOG_CACHE_KEY)).toBe(
        JSON.stringify(VALID_MANIFEST)
      );
    });

    it('falls back to the bundled catalog on a first launch with a slow network', async () => {
      mockFetchOnce(() => new Promise(() => {}));

      const pending = resolveModelCatalog();
      await jest.advanceTimersByTimeAsync(MODEL_CATALOG_STARTUP_WAIT_MS);

      expect((await pending).origin).toBe('fallback');
    });

    it('hands over the refreshed catalog when it was served from the cache', async () => {
      await AsyncStorage.setItem(
        MODEL_CATALOG_CACHE_KEY,
        JSON.stringify({
          ...VALID_MANIFEST,
          models: [{ ...VALID_MANIFEST.models[0], modelName: 'Cached Model' }],
        })
      );
      mockFetchOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(VALID_MANIFEST)),
        })
      );

      const result = await resolveModelCatalog();
      const refreshed = await result.refreshed;

      expect(result.models[0].modelName).toBe('Cached Model');
      expect(refreshed?.[0].modelName).toBe('Remote Model');
    });

    it('hands over the real catalog when a slow first launch showed the bundled one', async () => {
      let answer: () => void = () => {};
      mockFetchOnce(
        () =>
          new Promise((resolve) => {
            answer = () =>
              resolve({
                ok: true,
                status: 200,
                text: () => Promise.resolve(JSON.stringify(VALID_MANIFEST)),
              });
          })
      );

      const pending = resolveModelCatalog();
      await jest.advanceTimersByTimeAsync(MODEL_CATALOG_STARTUP_WAIT_MS);
      const result = await pending;
      answer();

      expect(result.origin).toBe('fallback');
      expect((await result.refreshed)?.[0].modelName).toBe('Remote Model');
    });

    it('has nothing to hand over after a fast remote answer', async () => {
      mockFetchOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(VALID_MANIFEST)),
        })
      );

      expect((await resolveModelCatalog()).refreshed).toBeUndefined();
    });

    it('still takes a fast answer', async () => {
      mockFetchOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(VALID_MANIFEST)),
        })
      );

      expect((await resolveModelCatalog()).origin).toBe('remote');
    });
  });
});
