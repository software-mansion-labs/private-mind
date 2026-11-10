import { useSTTStore } from '../store/sttStore';
import { createWhisperSpeechToText } from 'react-native-executorch';
import { localWhisperModel } from '../utils/sttModelFiles';

jest.mock('../utils/sttModelFiles', () => ({
  localWhisperModel: jest.fn(async () => LOCAL_WHISPER),
}));

const LOCAL_WHISPER = {
  modelPath: '/whisper.pte',
  tokenizerPath: '/tokenizer.json',
  supportedLanguages: ['en'],
  vadModel: { modelPath: '/vad.pte', defaultOptions: {} },
};

const mockCreateWhisper = createWhisperSpeechToText as jest.Mock;
const mockLocalWhisperModel = localWhisperModel as jest.Mock;

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
    mockLocalWhisperModel.mockImplementationOnce(async (onProgress) => {
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
    useSTTStore.setState({ isReady: true, module: mockModule as any });

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
