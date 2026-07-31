import { useEmbeddingModelStore } from '../store/embeddingModelStore';
import type { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';

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

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
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
