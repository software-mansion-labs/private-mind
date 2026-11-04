import { useSTTStore } from '../store/sttStore';
import { SpeechToTextModule } from 'react-native-executorch/legacy';
import {
  cancelWhisperFetch,
  fetchWhisperFiles,
  isWhisperDownloaded,
} from '../utils/sttModelFiles';
import { pauseModelDownloadsWhile } from '../store/modelStore';

jest.mock('../utils/sttModelFiles', () => ({
  isWhisperDownloaded: jest.fn(async () => true),
  fetchWhisperFiles: jest.fn(async () => true),
  cancelWhisperFetch: jest.fn(async () => undefined),
}));

jest.mock('../store/modelStore', () => ({
  pauseModelDownloadsWhile: jest.fn(async (work: () => Promise<unknown>) =>
    work()
  ),
}));

jest.mock('react-native-executorch/legacy', () => ({
  SpeechToTextModule: {
    fromModelName: jest.fn(),
  },
  WHISPER_TINY_EN: 'whisper-tiny-en',
}));

const mockFromModelName = SpeechToTextModule.fromModelName as jest.Mock;

const deferredFetch = () => {
  let finish!: (fetched: boolean) => void;
  (fetchWhisperFiles as jest.Mock).mockReturnValueOnce(
    new Promise<boolean>((resolve) => {
      finish = resolve;
    })
  );
  return { finish };
};

const mockModule = {
  stream: jest.fn(),
  streamInsert: jest.fn(),
  streamStop: jest.fn(),
};

beforeEach(() => {
  useSTTStore.setState({
    module: null,
    isReady: false,
    isLoading: false,
    isDownloading: false,
    loadProgress: 0,
    isFetchingFiles: false,
    filesProgress: 0,
  });
  jest.clearAllMocks();
  (isWhisperDownloaded as jest.Mock).mockResolvedValue(true);
});

describe('ensureLoaded', () => {
  it('sets isLoading during load and isReady after success', async () => {
    let resolveLoad!: (m: typeof mockModule) => void;
    mockFromModelName.mockReturnValue(
      new Promise((res) => {
        resolveLoad = res;
      })
    );

    const loadPromise = useSTTStore.getState().ensureLoaded();
    expect(useSTTStore.getState().isLoading).toBe(true);
    expect(useSTTStore.getState().isReady).toBe(false);

    resolveLoad(mockModule);
    await loadPromise;

    expect(useSTTStore.getState().isLoading).toBe(false);
    expect(useSTTStore.getState().isReady).toBe(true);
    expect(useSTTStore.getState().module).toBe(mockModule);
  });

  it('reports progress callbacks', async () => {
    mockFromModelName.mockImplementation((_name, _vad, onProgress) => {
      onProgress(0.5);
      onProgress(1.0);
      return Promise.resolve(mockModule);
    });

    await useSTTStore.getState().ensureLoaded();

    // Final progress is set to 1 by the .then() handler
    expect(useSTTStore.getState().loadProgress).toBe(1);
  });

  it('passes progress callback as the third argument for react-native-executorch 0.9+', async () => {
    mockFromModelName.mockResolvedValue(mockModule);

    await useSTTStore.getState().ensureLoaded();

    expect(mockFromModelName).toHaveBeenCalledWith(
      'whisper-tiny-en',
      undefined,
      expect.any(Function)
    );
  });

  it('returns immediately when already ready', async () => {
    useSTTStore.setState({ isReady: true, module: mockModule as any });

    await useSTTStore.getState().ensureLoaded();

    expect(mockFromModelName).not.toHaveBeenCalled();
  });

  it('concurrent calls share the same load promise (fromModelName called once)', async () => {
    mockFromModelName.mockResolvedValue(mockModule);

    await Promise.all([
      useSTTStore.getState().ensureLoaded(),
      useSTTStore.getState().ensureLoaded(),
      useSTTStore.getState().ensureLoaded(),
    ]);

    expect(mockFromModelName).toHaveBeenCalledTimes(1);
  });

  it('resets state on load failure', async () => {
    mockFromModelName.mockRejectedValue(new Error('load failed'));

    await expect(useSTTStore.getState().ensureLoaded()).rejects.toThrow(
      'load failed'
    );

    expect(useSTTStore.getState().isReady).toBe(false);
    expect(useSTTStore.getState().isLoading).toBe(false);
    expect(useSTTStore.getState().loadProgress).toBe(0);
    expect(useSTTStore.getState().module).toBeNull();
  });

  it('allows retrying after a failed load', async () => {
    mockFromModelName
      .mockRejectedValueOnce(new Error('first attempt failed'))
      .mockResolvedValueOnce(mockModule);

    await expect(useSTTStore.getState().ensureLoaded()).rejects.toThrow();

    // Second attempt should succeed
    await useSTTStore.getState().ensureLoaded();

    expect(useSTTStore.getState().isReady).toBe(true);
    expect(useSTTStore.getState().module).toBe(mockModule);
  });
});

describe('the first dictation, when the model still has to be downloaded', () => {
  it('holds the other model downloads while Whisper downloads, then releases them', async () => {
    (isWhisperDownloaded as jest.Mock).mockResolvedValue(false);
    let resolveLoad!: (m: typeof mockModule) => void;
    mockFromModelName.mockReturnValue(
      new Promise((res) => {
        resolveLoad = res;
      })
    );

    const loading = useSTTStore.getState().ensureLoaded();
    await Promise.resolve();
    await Promise.resolve();

    expect(pauseModelDownloadsWhile).toHaveBeenCalledTimes(1);
    expect(useSTTStore.getState().isDownloading).toBe(true);

    resolveLoad(mockModule);
    await loading;

    expect(useSTTStore.getState().isDownloading).toBe(false);
    expect(useSTTStore.getState().isReady).toBe(true);
  });

  it('leaves the other downloads running when Whisper is already on the phone', async () => {
    await useSTTStore.getState().ensureLoaded();

    expect(pauseModelDownloadsWhile).not.toHaveBeenCalled();
    expect(useSTTStore.getState().isDownloading).toBe(false);
  });

  it('stops reporting a download when it fails', async () => {
    (isWhisperDownloaded as jest.Mock).mockResolvedValue(false);
    mockFromModelName.mockRejectedValue(new Error('offline'));

    await expect(useSTTStore.getState().ensureLoaded()).rejects.toThrow(
      'offline'
    );

    expect(useSTTStore.getState().isDownloading).toBe(false);
    expect(useSTTStore.getState().isLoading).toBe(false);
  });
});

describe('fetching Whisper ahead of the first dictation', () => {
  it('downloads the files without loading the model', async () => {
    const fetched = await useSTTStore.getState().fetchFiles();

    expect(fetched).toBe(true);
    expect(mockFromModelName).not.toHaveBeenCalled();
    expect(useSTTStore.getState()).toMatchObject({
      isFetchingFiles: false,
      filesProgress: 1,
      isReady: false,
    });
  });

  it('reports a failed download as not fetched', async () => {
    (fetchWhisperFiles as jest.Mock).mockRejectedValueOnce(
      new Error('offline')
    );

    expect(await useSTTStore.getState().fetchFiles()).toBe(false);
    expect(useSTTStore.getState()).toMatchObject({
      isFetchingFiles: false,
      filesProgress: 0,
    });
  });

  it('shares one download between overlapping requests', async () => {
    const first = useSTTStore.getState().fetchFiles();
    const second = useSTTStore.getState().fetchFiles();

    expect(second).toBe(first);
    await first;
    expect(fetchWhisperFiles).toHaveBeenCalledTimes(1);
  });

  it('waits for an ongoing download before the first dictation loads the model', async () => {
    let finishFetch!: (fetched: boolean) => void;
    (fetchWhisperFiles as jest.Mock).mockReturnValueOnce(
      new Promise((resolve) => {
        finishFetch = resolve;
      })
    );
    mockFromModelName.mockResolvedValue(mockModule);

    const fetching = useSTTStore.getState().fetchFiles();
    const loading = useSTTStore.getState().ensureLoaded();
    await Promise.resolve();
    expect(isWhisperDownloaded).not.toHaveBeenCalled();

    finishFetch(true);
    await fetching;
    await loading;

    expect(pauseModelDownloadsWhile).not.toHaveBeenCalled();
    expect(useSTTStore.getState().isReady).toBe(true);
  });

  it('cancels only while a download is running', async () => {
    await useSTTStore.getState().cancelFetchFiles();
    expect(cancelWhisperFetch).not.toHaveBeenCalled();

    const fetch = deferredFetch();
    const fetching = useSTTStore.getState().fetchFiles();
    await useSTTStore.getState().cancelFetchFiles();

    expect(cancelWhisperFetch).toHaveBeenCalledTimes(1);
    fetch.finish(false);
    await fetching;
  });

  it('stops retrying the cancel once the fetch has settled', async () => {
    const fetch = deferredFetch();
    const fetching = useSTTStore.getState().fetchFiles();
    await useSTTStore.getState().cancelFetchFiles();

    const isStillFetching = (cancelWhisperFetch as jest.Mock).mock.calls[0][0];
    expect(isStillFetching()).toBe(true);

    fetch.finish(false);
    await fetching;

    expect(isStillFetching()).toBe(false);
  });

  it('clears the fetching state as soon as the user cancels', async () => {
    const fetch = deferredFetch();
    const fetching = useSTTStore.getState().fetchFiles();
    useSTTStore.setState({ filesProgress: 0.5 });

    const cancelling = useSTTStore.getState().cancelFetchFiles();

    expect(useSTTStore.getState().isFetchingFiles).toBe(false);
    expect(useSTTStore.getState().filesProgress).toBe(0);

    await cancelling;
    fetch.finish(false);
    await fetching;
  });

  it('ignores a fetch that finishes after the cancel', async () => {
    const fetch = deferredFetch();
    const fetching = useSTTStore.getState().fetchFiles();
    await useSTTStore.getState().cancelFetchFiles();

    fetch.finish(true);

    expect(await fetching).toBe(false);
    expect(useSTTStore.getState().filesProgress).toBe(0);
  });

  it('starts a new fetch only after the cancelled one has settled', async () => {
    const cancelled = deferredFetch();
    const first = useSTTStore.getState().fetchFiles();
    await useSTTStore.getState().cancelFetchFiles();

    (fetchWhisperFiles as jest.Mock).mockResolvedValueOnce(true);
    const second = useSTTStore.getState().fetchFiles();

    expect(useSTTStore.getState().isFetchingFiles).toBe(true);
    expect(fetchWhisperFiles).toHaveBeenCalledTimes(1);

    cancelled.finish(false);

    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(fetchWhisperFiles).toHaveBeenCalledTimes(2);
    expect(useSTTStore.getState().isFetchingFiles).toBe(false);
    expect(useSTTStore.getState().filesProgress).toBe(1);
  });
});
