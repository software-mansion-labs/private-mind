import {
  embeddingModelNeedsDownloadPrompt,
  useEmbeddingModelStore,
  whenEmbeddingStatusKnown,
} from '../store/embeddingModelStore';
import type { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import { ResourceFetcher } from 'react-native-executorch/legacy';
import { LFM_2_5_EMBEDDING_SOURCES } from '../constants/embedding-model';

const mockFetch = ResourceFetcher.fetch as jest.Mock;

const makeStore = (load: jest.Mock) =>
  ({ load }) as unknown as OPSQLiteVectorStore;

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const settlePromises = () =>
  new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(['model.pte', 'tokenizer.json']);
  useEmbeddingModelStore.setState({ status: 'unknown', progress: 0 });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('embeddingModelStore.ensureReady', () => {
  it('returns true immediately without loading when already ready', async () => {
    useEmbeddingModelStore.setState({ status: 'ready', progress: 1 });
    const load = jest.fn();

    const ready = await useEmbeddingModelStore
      .getState()
      .ensureReady(makeStore(load));

    expect(ready).toBe(true);
    expect(load).not.toHaveBeenCalled();
  });

  it('downloads then marks the model ready on success', async () => {
    const load = jest.fn().mockResolvedValue(undefined);

    const ready = await useEmbeddingModelStore
      .getState()
      .ensureReady(makeStore(load));

    expect(ready).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    expect(useEmbeddingModelStore.getState().status).toBe('ready');
    expect(useEmbeddingModelStore.getState().progress).toBe(1);
  });

  it('sets an error status when the download fails (no network / no space / interrupted)', async () => {
    const load = jest
      .fn()
      .mockRejectedValue(new Error('Network request failed'));

    const ready = await useEmbeddingModelStore
      .getState()
      .ensureReady(makeStore(load));

    expect(ready).toBe(false);
    expect(useEmbeddingModelStore.getState().status).toBe('error');
    expect(useEmbeddingModelStore.getState().progress).toBe(0);
    expect(console.error).toHaveBeenCalled();
  });

  it('reports downloading status while the download is in flight', async () => {
    const deferred = createDeferred<void>();
    const load = jest.fn().mockReturnValue(deferred.promise);

    const pending = useEmbeddingModelStore
      .getState()
      .ensureReady(makeStore(load));

    expect(useEmbeddingModelStore.getState().status).toBe('downloading');
    expect(useEmbeddingModelStore.getState().progress).toBe(0);

    deferred.resolve();
    await pending;
    expect(useEmbeddingModelStore.getState().status).toBe('ready');
  });

  it('single-flights concurrent calls so the model downloads only once', async () => {
    const deferred = createDeferred<void>();
    const load = jest.fn().mockReturnValue(deferred.promise);
    const store = makeStore(load);

    const first = useEmbeddingModelStore.getState().ensureReady(store);
    const second = useEmbeddingModelStore.getState().ensureReady(store);

    deferred.resolve();
    const [a, b] = await Promise.all([first, second]);

    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('downloads the files before handing the load to the loader', async () => {
    const order: string[] = [];
    mockFetch.mockImplementation(async () => {
      order.push('fetch');
      return ['model.pte', 'tokenizer.json'];
    });
    const load = jest.fn(async () => {
      order.push('load');
    });
    const loadModel = jest.fn((run: () => Promise<unknown>) => {
      order.push('loader');
      return run();
    });

    const ready = await useEmbeddingModelStore
      .getState()
      .ensureReady(makeStore(load), loadModel);

    expect(ready).toBe(true);
    expect(order).toEqual(['fetch', 'loader', 'load']);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(Function),
      LFM_2_5_EMBEDDING_SOURCES.modelSource,
      LFM_2_5_EMBEDDING_SOURCES.tokenizerSource
    );
  });

  it('shows the download moving while the loader is still waiting for its turn', async () => {
    const fetchDone = createDeferred<string[]>();
    mockFetch.mockImplementation((onProgress: (p: number) => void) => {
      onProgress(0.4);
      return fetchDone.promise;
    });
    const loaderTurn = createDeferred<void>();
    const loadModel = jest.fn(async (run: () => Promise<unknown>) => {
      await loaderTurn.promise;
      return run();
    });
    const load = jest.fn().mockResolvedValue(undefined);

    const pending = useEmbeddingModelStore
      .getState()
      .ensureReady(makeStore(load), loadModel);

    expect(useEmbeddingModelStore.getState().status).toBe('downloading');
    expect(useEmbeddingModelStore.getState().progress).toBe(0.4);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    fetchDone.resolve(['model.pte', 'tokenizer.json']);
    await settlePromises();
    expect(loadModel).toHaveBeenCalledTimes(1);
    expect(load).not.toHaveBeenCalled();
    expect(useEmbeddingModelStore.getState().status).toBe('downloading');
    expect(useEmbeddingModelStore.getState().progress).toBe(1);

    loaderTurn.resolve();
    await expect(pending).resolves.toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    expect(useEmbeddingModelStore.getState().status).toBe('ready');
  });

  it('fails without loading anything when the download is interrupted', async () => {
    mockFetch.mockResolvedValue(null);
    const load = jest.fn();
    const loadModel = jest.fn();

    const ready = await useEmbeddingModelStore
      .getState()
      .ensureReady(makeStore(load), loadModel);

    expect(ready).toBe(false);
    expect(loadModel).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    expect(useEmbeddingModelStore.getState().status).toBe('error');
  });

  it('allows a fresh retry after a failed download', async () => {
    const load = jest
      .fn()
      .mockRejectedValueOnce(new Error('No space left on device'))
      .mockResolvedValueOnce(undefined);
    const store = makeStore(load);

    const first = await useEmbeddingModelStore.getState().ensureReady(store);
    expect(first).toBe(false);
    expect(useEmbeddingModelStore.getState().status).toBe('error');

    const second = await useEmbeddingModelStore.getState().ensureReady(store);
    expect(second).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
    expect(useEmbeddingModelStore.getState().status).toBe('ready');
  });
});

describe('whenEmbeddingStatusKnown', () => {
  it('resolves at once when the status is already known', async () => {
    useEmbeddingModelStore.setState({ status: 'ready' });
    await expect(whenEmbeddingStatusKnown()).resolves.toBe('ready');
  });

  it('waits through the unknown window until the provider settles', async () => {
    const pending = whenEmbeddingStatusKnown();
    useEmbeddingModelStore.setState({ status: 'ready' });
    await expect(pending).resolves.toBe('ready');
  });

  it('gives up as unknown when nothing ever settles', async () => {
    jest.useFakeTimers();
    try {
      const pending = whenEmbeddingStatusKnown(50);
      jest.advanceTimersByTime(50);
      await expect(pending).resolves.toBe('unknown');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('embeddingModelNeedsDownloadPrompt', () => {
  it.each(['not_downloaded', 'downloading', 'error'] as const)(
    'prompts for %s',
    (status) => {
      expect(embeddingModelNeedsDownloadPrompt(status)).toBe(true);
    }
  );

  it.each(['ready', 'unknown'] as const)('stays quiet for %s', (status) => {
    expect(embeddingModelNeedsDownloadPrompt(status)).toBe(false);
  });
});
