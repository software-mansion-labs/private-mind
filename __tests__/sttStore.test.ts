import { useSTTStore } from '../store/sttStore';
import { SpeechToTextModule } from 'react-native-executorch';

jest.mock('react-native-executorch', () => ({
  SpeechToTextModule: {
    fromModelName: jest.fn(),
  },
  WHISPER_TINY_EN: 'whisper-tiny-en',
}));

const mockFromModelName = SpeechToTextModule.fromModelName as jest.Mock;

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
    loadProgress: 0,
  });
  jest.clearAllMocks();
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
    mockFromModelName.mockImplementation((_name, onProgress) => {
      onProgress(0.5);
      onProgress(1.0);
      return Promise.resolve(mockModule);
    });

    await useSTTStore.getState().ensureLoaded();

    // Final progress is set to 1 by the .then() handler
    expect(useSTTStore.getState().loadProgress).toBe(1);
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
