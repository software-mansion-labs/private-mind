import React from 'react';
import { render, act } from '@testing-library/react-native';

const mockStoreInstances: Array<{
  name: string;
  db: unknown;
  load: jest.Mock;
  unload: jest.Mock;
}> = [];

jest.mock('@react-native-rag/op-sqlite', () => ({
  OPSQLiteVectorStore: jest
    .fn()
    .mockImplementation((opts: { name: string }) => {
      const instance = {
        name: opts.name,
        db: { __fakeDb: true },
        load: jest.fn().mockResolvedValue(undefined),
        unload: jest.fn().mockResolvedValue(undefined),
      };
      mockStoreInstances.push(instance);
      return instance;
    }),
}));

jest.mock('expo-sqlite', () => {
  const db = { __db: true };
  return { useSQLiteContext: jest.fn(() => db) };
});

jest.mock('../utils/embeddingModelMigration', () => ({
  migrateEmbeddingModelIfNeeded: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/embeddingModel', () => ({
  isEmbeddingModelDownloaded: jest.fn().mockResolvedValue(true),
}));

jest.mock('../utils/lfmEmbeddings', () => ({
  LFMEmbeddings: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../store/embeddingModelStore', () => ({
  useEmbeddingModelStore: {
    getState: jest.fn(() => ({
      setProgress: jest.fn(),
      markReady: jest.fn(),
      setStatus: jest.fn(),
    })),
  },
}));

import { VectorStoreProvider } from '../context/VectorStoreContext';
import { migrateEmbeddingModelIfNeeded } from '../utils/embeddingModelMigration';

const mockMigrate = migrateEmbeddingModelIfNeeded as jest.Mock;

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
};

const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  });
};

const renderProvider = () =>
  render(<VectorStoreProvider>{null}</VectorStoreProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreInstances.length = 0;
  mockMigrate.mockResolvedValue(undefined);
});

afterEach(async () => {
  await flush();
});

describe('VectorStoreProvider init/teardown chain', () => {
  it('mount → unmount → mount does a single unload per store', async () => {
    const first = renderProvider();
    await flush();
    expect(mockStoreInstances).toHaveLength(1);
    expect(mockStoreInstances[0].unload).not.toHaveBeenCalled();

    first.unmount();
    await flush();
    expect(mockStoreInstances[0].unload).toHaveBeenCalledTimes(1);

    renderProvider();
    await flush();
    expect(mockStoreInstances).toHaveLength(2);
    expect(mockStoreInstances[0].unload).toHaveBeenCalledTimes(1);
    expect(mockStoreInstances[1].unload).not.toHaveBeenCalled();
  });

  it('unmount during init unloads the store exactly once', async () => {
    const deferred = createDeferred<void>();
    mockMigrate.mockReturnValueOnce(deferred.promise);

    const { unmount } = renderProvider();
    await flush();
    expect(mockStoreInstances).toHaveLength(1);
    const store = mockStoreInstances[0];
    expect(store.unload).not.toHaveBeenCalled();

    unmount();
    await flush();

    await act(async () => {
      deferred.resolve();
    });
    await flush();

    expect(store.unload).toHaveBeenCalledTimes(1);
  });

  it('cancel during migrate skips load and does not publish the store', async () => {
    const deferred = createDeferred<void>();
    mockMigrate.mockReturnValueOnce(deferred.promise);

    const { unmount } = renderProvider();
    await flush();
    const store = mockStoreInstances[0];

    unmount();
    await flush();

    await act(async () => {
      deferred.resolve();
    });
    await flush();

    expect(mockMigrate).toHaveBeenCalledTimes(1);
    expect(store.load).not.toHaveBeenCalled();
    expect(store.unload).toHaveBeenCalledTimes(1);
  });

  it('cancel before init reaches the store creates and unloads nothing', async () => {
    const { unmount } = renderProvider();
    unmount();
    await flush();

    expect(mockStoreInstances).toHaveLength(0);
    expect(mockMigrate).not.toHaveBeenCalled();
  });
});
