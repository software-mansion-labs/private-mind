import { renderHook, act, waitFor } from '@testing-library/react-native';
import { SpeechToTextModule } from 'react-native-executorch/legacy';
import { useSTTStore } from '../store/sttStore';
import { useSpeechInput } from '../hooks/useSpeechInput';
import * as audioApi from 'react-native-audio-api';
import { AudioManager } from 'react-native-audio-api';

const makeModule = () => {
  let requestStop = () => {};
  const module = {
    heardBeforeStop: [] as string[],
    finishing: Promise.resolve(),
    stream: jest.fn(async function* (): AsyncGenerator<string> {
      const stopped = new Promise<void>((resolve) => {
        requestStop = resolve;
      });
      yield* module.heardBeforeStop;
      await stopped;
      await module.finishing;
    }),
    streamStop: jest.fn(() => requestStop()),
    delete: jest.fn(),
  };
  return module;
};

let sttModule: ReturnType<typeof makeModule>;

const readAll = async (transcript: AsyncGenerator<unknown>) => {
  for await (const _ of transcript);
};

beforeEach(() => {
  jest.clearAllMocks();
  sttModule = makeModule();
  (SpeechToTextModule.fromModelName as jest.Mock).mockResolvedValue(sttModule);
  useSTTStore.setState({
    module: null,
    isReady: false,
    isLoading: false,
    loadProgress: 0,
    streamEnd: null,
  });
});

describe('speech input after a transcript is abandoned', () => {
  it('closes the stream left open before opening the next one', async () => {
    const first = renderHook(() => useSpeechInput());
    await act(async () => {
      readAll((await first.result.current.start())!);
    });
    expect(useSTTStore.getState().streamEnd).not.toBeNull();
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
    sttModule.stream.mockImplementation(async function* () {
      yield* [];
      throw new Error('Streaming is already in progress!');
    });

    await act(async () => {
      const transcript = (await result.current.start())!;
      await expect(transcript.next()).rejects.toThrow(
        'Streaming is already in progress!'
      );
    });

    expect(useSTTStore.getState().module).toBeNull();
    expect(useSTTStore.getState().isReady).toBe(false);
    expect(sttModule.delete).toHaveBeenCalledTimes(1);
  });

  it('releases a given-up module only after its stream has ended', async () => {
    let endStream!: () => void;
    useSTTStore.setState({ module: sttModule as never });
    useSTTStore.getState().trackStream(
      new Promise<void>((resolve) => {
        endStream = resolve;
      })
    );

    useSTTStore.getState().discardModule();
    await Promise.resolve();
    expect(sttModule.delete).not.toHaveBeenCalled();

    endStream();
    await waitFor(() => expect(sttModule.delete).toHaveBeenCalledTimes(1));
  });

  it('leaves no stream marked open once the recorder is abandoned', async () => {
    const { result } = renderHook(() => useSpeechInput());
    await act(async () => {
      const transcript = (await result.current.start())!;
      const reading = transcript.next();
      result.current.abandon();
      await reading;
      await transcript.return();
    });

    expect(sttModule.streamStop).toHaveBeenCalledTimes(1);
    expect(useSTTStore.getState().streamEnd).toBeNull();
  });

  it('opens the next stream only once the abandoned one has finished', async () => {
    let finishNatively!: () => void;
    sttModule.finishing = new Promise((resolve) => {
      finishNatively = resolve;
    });
    sttModule.heardBeforeStop = ['hello'];
    const first = renderHook(() => useSpeechInput());
    await act(async () => {
      const transcript = (await first.result.current.start())!;
      for await (const _ of transcript) break;
    });
    act(() => first.result.current.abandon());
    first.unmount();

    const second = renderHook(() => useSpeechInput());
    let secondStart!: Promise<unknown>;
    await act(async () => {
      secondStart = second.result.current.start();
    });
    expect(sttModule.stream).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishNatively();
      await secondStart;
    });
    expect(sttModule.stream).toHaveBeenCalledTimes(2);
    expect(second.result.current.status).toBe('listening');
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
    expect(useSTTStore.getState().streamEnd).toBeNull();
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
