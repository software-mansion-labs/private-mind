import { renderHook, act } from '@testing-library/react-native';
import { SpeechToTextModule } from 'react-native-executorch/legacy';
import { useSTTStore } from '../store/sttStore';
import { useSpeechInput } from '../hooks/useSpeechInput';
import * as audioApi from 'react-native-audio-api';
import { AudioManager } from 'react-native-audio-api';

const neverEndingStream = async function* () {
  yield await new Promise<never>(() => {});
};

const makeModule = () => ({
  stream: jest.fn(() => neverEndingStream()),
  streamStop: jest.fn(),
});

let sttModule: ReturnType<typeof makeModule>;

beforeEach(() => {
  jest.clearAllMocks();
  sttModule = makeModule();
  (SpeechToTextModule.fromModelName as jest.Mock).mockResolvedValue(sttModule);
  useSTTStore.setState({
    module: null,
    isReady: false,
    isLoading: false,
    loadProgress: 0,
    streamOpen: false,
  });
});

describe('speech input after a transcript is abandoned', () => {
  it('closes the stream left open before opening the next one', async () => {
    const first = renderHook(() => useSpeechInput());
    await act(async () => {
      await first.result.current.start();
    });
    expect(useSTTStore.getState().streamOpen).toBe(true);
    first.unmount();

    const second = renderHook(() => useSpeechInput());
    await act(async () => {
      await second.result.current.start();
    });

    expect(sttModule.streamStop).toHaveBeenCalledTimes(1);
    expect(sttModule.stream).toHaveBeenCalledTimes(2);
  });

  it('gives up a module whose stream refuses to open, so the next try reloads', async () => {
    const { result } = renderHook(() => useSpeechInput());
    sttModule.stream.mockImplementation(() => {
      throw new Error('stream already running');
    });

    await act(async () => {
      await expect(result.current.start()).rejects.toThrow(
        'stream already running'
      );
    });

    expect(useSTTStore.getState().module).toBeNull();
    expect(useSTTStore.getState().isReady).toBe(false);
  });

  it('leaves no stream marked open once the recorder is abandoned', async () => {
    const { result } = renderHook(() => useSpeechInput());
    await act(async () => {
      await result.current.start();
    });

    act(() => result.current.abandon());

    expect(sttModule.streamStop).toHaveBeenCalledTimes(1);
    expect(useSTTStore.getState().streamOpen).toBe(false);
  });
});

describe('the audio session dictation turns on', () => {
  const sessionTurnedOff = () =>
    (AudioManager.setAudioSessionActivity as jest.Mock).mock.calls.some(
      ([active]) => active === false
    );

  it('is turned off again when dictation is cancelled while the model loads', async () => {
    let finishLoading!: (module: typeof sttModule) => void;
    (SpeechToTextModule.fromModelName as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishLoading = resolve;
        })
    );
    const { result } = renderHook(() => useSpeechInput());

    let started!: Promise<unknown>;
    await act(async () => {
      started = result.current.start();
      await Promise.resolve();
    });
    await act(async () => {
      result.current.stop();
      finishLoading(sttModule);
      await expect(started).resolves.toBeNull();
    });

    expect(sessionTurnedOff()).toBe(true);
  });

  it('is turned off and the stream closed when the recorder cannot start', async () => {
    jest.spyOn(audioApi, 'AudioRecorder').mockImplementation(
      () =>
        ({
          onAudioReady: jest.fn(),
          start: jest.fn(() => ({
            status: 'error',
            message: 'microphone busy',
          })),
          stop: jest.fn(),
        }) as never
    );
    const { result } = renderHook(() => useSpeechInput());

    await act(async () => {
      await expect(result.current.start()).rejects.toThrow('microphone busy');
    });

    expect(sessionTurnedOff()).toBe(true);
    expect(useSTTStore.getState().streamOpen).toBe(false);
    expect(result.current.status).toBe('idle');
  });

  it('is turned off when the speech model fails to load', async () => {
    (SpeechToTextModule.fromModelName as jest.Mock).mockRejectedValueOnce(
      new Error('download failed')
    );
    const { result } = renderHook(() => useSpeechInput());

    await act(async () => {
      await expect(result.current.start()).rejects.toThrow();
    });

    expect(sessionTurnedOff()).toBe(true);
  });
});
