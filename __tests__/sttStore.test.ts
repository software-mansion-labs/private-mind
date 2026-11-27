import { useSTTStore } from '../store/sttStore';
import { createWhisperSpeechToText } from 'react-native-executorch';
import {
  cancelWhisperFetch,
  deleteWhisperFiles,
  fetchWhisperFiles,
  isWhisperDownloaded,
  localWhisperModel,
} from '../utils/sttModelFiles';
import { pauseModelDownloadsWhile } from '../store/modelStore';

jest.mock('../utils/sttModelFiles', () => ({
  STT_MODEL_KINDS: ['english', 'multilingual'],
  isWhisperDownloaded: jest.fn(async () => true),
  fetchWhisperFiles: jest.fn(async () => true),
  cancelWhisperFetch: jest.fn(async () => undefined),
  deleteWhisperFiles: jest.fn(async () => undefined),
  localWhisperModel: jest.fn(async () => LOCAL_WHISPER),
  whisperDownloadSizeBytes: jest.fn(() => 80_000_000),
}));

const LOCAL_WHISPER = {
  modelPath: '/whisper.pte',
  tokenizerPath: '/tokenizer.json',
  supportedLanguages: ['en'],
  vadModel: { modelPath: '/vad.pte', defaultOptions: {} },
};

jest.mock('../store/modelStore', () => ({
  pauseModelDownloadsWhile: jest.fn(async (work: () => Promise<unknown>) =>
    work()
  ),
}));

const mockCreateWhisper = createWhisperSpeechToText as jest.Mock;
const mockLocalWhisperModel = localWhisperModel as jest.Mock;

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
  dispose: jest.fn(),
};

beforeEach(() => {
  useSTTStore.setState({
    module: null,
    moduleKind: null,
    fetchingKind: null,
    onDisk: { english: false, multilingual: false },
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
    mockCreateWhisper.mockReturnValue(
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
    mockLocalWhisperModel.mockImplementationOnce(async (_kind, onProgress) => {
      onProgress(0.5);
      onProgress(1.0);
      return LOCAL_WHISPER;
    });
    mockCreateWhisper.mockResolvedValue(mockModule);

    await useSTTStore.getState().ensureLoaded();

    // Final progress is set to 1 by the .then() handler
    expect(useSTTStore.getState().loadProgress).toBe(1);
  });

  it('builds the recognizer from the files on disk', async () => {
    mockCreateWhisper.mockResolvedValue(mockModule);

    await useSTTStore.getState().ensureLoaded();

    expect(mockCreateWhisper).toHaveBeenCalledWith(LOCAL_WHISPER);
  });

  it('returns immediately when already ready', async () => {
    useSTTStore.setState({
      isReady: true,
      module: mockModule as any,
      moduleKind: 'english',
    });

    await useSTTStore.getState().ensureLoaded();

    expect(mockCreateWhisper).not.toHaveBeenCalled();
  });

  it('concurrent calls share the same load promise (the recognizer is built once)', async () => {
    mockCreateWhisper.mockResolvedValue(mockModule);

    await Promise.all([
      useSTTStore.getState().ensureLoaded(),
      useSTTStore.getState().ensureLoaded(),
      useSTTStore.getState().ensureLoaded(),
    ]);

    expect(mockCreateWhisper).toHaveBeenCalledTimes(1);
  });

  it('resets state on load failure', async () => {
    mockCreateWhisper.mockRejectedValue(new Error('load failed'));

    await expect(useSTTStore.getState().ensureLoaded()).rejects.toThrow(
      'load failed'
    );

    expect(useSTTStore.getState().isReady).toBe(false);
    expect(useSTTStore.getState().isLoading).toBe(false);
    expect(useSTTStore.getState().loadProgress).toBe(0);
    expect(useSTTStore.getState().module).toBeNull();
  });

  it('allows retrying after a failed load', async () => {
    mockCreateWhisper
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
    mockCreateWhisper.mockReturnValue(
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
    mockCreateWhisper.mockRejectedValue(new Error('offline'));

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
    expect(mockCreateWhisper).not.toHaveBeenCalled();
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
    mockCreateWhisper.mockResolvedValue(mockModule);

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

    const isStillFetching = (cancelWhisperFetch as jest.Mock).mock.calls[0][1];
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

const makeModule = (name: string, events: string[]) => ({
  name,
  stream: jest.fn(),
  streamInsert: jest.fn(),
  streamStop: jest.fn(),
  dispose: jest.fn(() => {
    events.push(`dispose ${name}`);
  }),
});

const createInOrder = (events: string[], ...names: string[]) => {
  for (const name of names) {
    mockCreateWhisper.mockImplementationOnce(async () => {
      events.push(`create ${name}`);
      return makeModule(name, events);
    });
  }
};

describe('dictation in a language other than English', () => {
  it('loads the multilingual recognizer from its own files', async () => {
    mockCreateWhisper.mockResolvedValue(mockModule);

    await useSTTStore.getState().ensureLoaded('multilingual');

    expect(mockLocalWhisperModel).toHaveBeenCalledWith(
      'multilingual',
      expect.any(Function)
    );
    expect(useSTTStore.getState()).toMatchObject({
      moduleKind: 'multilingual',
      requestedKind: 'multilingual',
      isReady: true,
    });
    expect(useSTTStore.getState().onDisk.multilingual).toBe(true);
  });

  it('holds the other model downloads while the multilingual model downloads too', async () => {
    (isWhisperDownloaded as jest.Mock).mockResolvedValue(false);
    let resolveLoad!: (m: typeof mockModule) => void;
    mockCreateWhisper.mockReturnValue(
      new Promise((res) => {
        resolveLoad = res;
      })
    );

    const loading = useSTTStore.getState().ensureLoaded('multilingual');
    await new Promise(setImmediate);

    expect(isWhisperDownloaded).toHaveBeenCalledWith('multilingual');
    expect(pauseModelDownloadsWhile).toHaveBeenCalledTimes(1);
    expect(useSTTStore.getState().isDownloading).toBe(true);

    resolveLoad(mockModule);
    await loading;

    expect(useSTTStore.getState().isDownloading).toBe(false);
  });

  it('is ready only for the kind it loaded', async () => {
    const events: string[] = [];
    createInOrder(events, 'english', 'multilingual');

    await useSTTStore.getState().ensureLoaded('english');
    await useSTTStore.getState().ensureLoaded('english');
    await useSTTStore.getState().ensureLoaded('multilingual');

    expect(mockCreateWhisper).toHaveBeenCalledTimes(2);
  });
});

describe('switching the dictation language', () => {
  it('frees the English recognizer before it builds the multilingual one', async () => {
    const events: string[] = [];
    createInOrder(events, 'english', 'multilingual');

    await useSTTStore.getState().ensureLoaded('english');
    await useSTTStore.getState().ensureLoaded('multilingual');

    expect(events).toEqual([
      'create english',
      'dispose english',
      'create multilingual',
    ]);
  });

  it('waits for a recognizer still loading, then frees it before loading the other', async () => {
    const events: string[] = [];
    createInOrder(events, 'english', 'multilingual');

    const english = useSTTStore.getState().ensureLoaded('english');
    const multilingual = useSTTStore.getState().ensureLoaded('multilingual');
    await Promise.all([english, multilingual]);

    expect(events).toEqual([
      'create english',
      'dispose english',
      'create multilingual',
    ]);
    expect(useSTTStore.getState().moduleKind).toBe('multilingual');
  });

  it('keeps the next recognizer waiting until the open transcript stream has ended', async () => {
    const events: string[] = [];
    createInOrder(events, 'english', 'multilingual');
    await useSTTStore.getState().ensureLoaded('english');

    let endStream!: () => void;
    useSTTStore.getState().trackStream(
      new Promise<void>((resolve) => {
        endStream = resolve;
      })
    );
    const loading = useSTTStore.getState().ensureLoaded('multilingual');
    await new Promise(setImmediate);

    expect(events).toEqual(['create english']);

    endStream();
    await loading;

    expect(events).toEqual([
      'create english',
      'dispose english',
      'create multilingual',
    ]);
  });

  it('releases a recognizer of the other kind when a language is picked in settings', async () => {
    const events: string[] = [];
    createInOrder(events, 'english');
    await useSTTStore.getState().ensureLoaded('english');

    useSTTStore.getState().releaseModelOtherThan('english');
    await new Promise(setImmediate);
    expect(events).toEqual(['create english']);

    useSTTStore.getState().releaseModelOtherThan('multilingual');
    await new Promise(setImmediate);
    expect(events).toEqual(['create english', 'dispose english']);
    expect(useSTTStore.getState().module).toBeNull();
  });
});

describe('managing the dictation models on the phone', () => {
  it('downloads the multilingual files ahead of time and remembers they are there', async () => {
    const fetching = useSTTStore.getState().fetchFiles('multilingual');

    expect(useSTTStore.getState().fetchingKind).toBe('multilingual');
    expect(await fetching).toBe(true);
    expect(fetchWhisperFiles).toHaveBeenCalledWith(
      'multilingual',
      expect.any(Function)
    );
    expect(useSTTStore.getState().fetchingKind).toBeNull();
    expect(useSTTStore.getState().onDisk.multilingual).toBe(true);
  });

  it('cancels the download of the kind that is being fetched', async () => {
    const fetch = deferredFetch();
    const fetching = useSTTStore.getState().fetchFiles('multilingual');

    await useSTTStore.getState().cancelFetchFiles();

    expect(cancelWhisperFetch).toHaveBeenCalledWith(
      'multilingual',
      expect.any(Function)
    );
    fetch.finish(false);
    await fetching;
  });

  it('does not wait for an English download before loading the multilingual model', async () => {
    const fetch = deferredFetch();
    mockCreateWhisper.mockResolvedValue(mockModule);
    const fetching = useSTTStore.getState().fetchFiles('english');

    await useSTTStore.getState().ensureLoaded('multilingual');

    expect(useSTTStore.getState().moduleKind).toBe('multilingual');
    fetch.finish(true);
    await fetching;
  });

  it('frees the loaded recognizer before deleting its files', async () => {
    const events: string[] = [];
    createInOrder(events, 'multilingual');
    (deleteWhisperFiles as jest.Mock).mockImplementationOnce(async () => {
      events.push('delete multilingual files');
    });
    await useSTTStore.getState().ensureLoaded('multilingual');

    await useSTTStore.getState().deleteModelFiles('multilingual');

    expect(events).toEqual([
      'create multilingual',
      'dispose multilingual',
      'delete multilingual files',
    ]);
    expect(useSTTStore.getState().module).toBeNull();
    expect(useSTTStore.getState().onDisk.multilingual).toBe(false);
  });

  it('keeps the English recognizer when the multilingual files are deleted', async () => {
    const events: string[] = [];
    createInOrder(events, 'english');
    await useSTTStore.getState().ensureLoaded('english');

    await useSTTStore.getState().deleteModelFiles('multilingual');

    expect(deleteWhisperFiles).toHaveBeenCalledWith('multilingual');
    expect(events).toEqual(['create english']);
    expect(useSTTStore.getState().moduleKind).toBe('english');
  });

  it('stops a running download of the model being deleted', async () => {
    const fetch = deferredFetch();
    const fetching = useSTTStore.getState().fetchFiles('multilingual');

    const deleting = useSTTStore.getState().deleteModelFiles('multilingual');
    fetch.finish(false);
    await deleting;
    await fetching;

    expect(cancelWhisperFetch).toHaveBeenCalledTimes(1);
    expect(deleteWhisperFiles).toHaveBeenCalledWith('multilingual');
  });

  it('reads which models are on the phone', async () => {
    (isWhisperDownloaded as jest.Mock).mockImplementation(
      async (kind: string) => kind === 'english'
    );

    const onDisk = await useSTTStore.getState().refreshOnDisk();

    expect(onDisk).toEqual({ english: true, multilingual: false });
    expect(useSTTStore.getState().onDisk).toEqual(onDisk);
  });
});
