import { AppState } from 'react-native';
import Toast from 'react-native-toast-message';
import { createReverbTextToSpeech } from 'react-native-executorch';
import { useLLMStore } from '../store/llmStore';
import { useReadAloudStore } from '../store/readAloudStore';
import { useSTTStore } from '../store/sttStore';
import { createPcmPlayer } from '../utils/pcmPlayer';
import {
  cancelReadAloudFetch,
  isReadAloudDownloaded,
  localReadAloudModel,
} from '../utils/readAloudModelFiles';
import type { ReadAloudPlan } from '../utils/readAloudPlan';

jest.mock('../store/llmStore', () => {
  const { create } = jest.requireActual('zustand');
  return {
    useLLMStore: create(() => ({
      isGenerating: false,
      isProcessingPrompt: false,
      isBenchmarking: false,
      isLoading: false,
    })),
  };
});

jest.mock('../store/sttStore', () => {
  const { create } = jest.requireActual('zustand');
  return {
    useSTTStore: create((set: any, get: any) => ({
      audioSessionOwner: 0,
      claimAudioSession: () => {
        const claim = get().audioSessionOwner + 1;
        set({ audioSessionOwner: claim });
        return claim;
      },
    })),
  };
});

jest.mock('../store/modelStore', () => ({
  pauseModelDownloadsWhile: jest.fn(async (work: () => Promise<unknown>) =>
    work()
  ),
}));

jest.mock('../utils/pcmPlayer', () => ({ createPcmPlayer: jest.fn() }));

jest.mock('../utils/readAloudModelFiles', () => ({
  cancelReadAloudFetch: jest.fn(async () => 'landed'),
  isReadAloudDownloaded: jest.fn(async () => true),
  localReadAloudModel: jest.fn(async () => ({ name: 'reverb' })),
  readAloudDownloadBytes: jest.fn(() => 400_000_000),
}));

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

const PLAN: ReadAloudPlan = {
  text: 'Hello there.',
  language: 'en',
  voice: 'en_female_narrator',
};

interface FakeRun {
  module: {
    synthesize: jest.Mock;
    synthesizeStop: jest.Mock;
    dispose: jest.Mock;
  };
  deliver: (audio?: Float32Array) => Promise<void>;
  end: () => Promise<void>;
  generatorFinished: () => boolean;
}

const fakeRun = (): FakeRun => {
  const waiting: ((chunk: Float32Array | null) => void)[] = [];
  let finished = false;
  const nextChunk = () =>
    new Promise<Float32Array | null>((resolve) => waiting.push(resolve));

  const module = {
    synthesize: jest.fn(async function* () {
      try {
        for (;;) {
          const chunk = await nextChunk();
          if (!chunk) return;
          yield { audio: chunk, sampleRate: 24000 };
        }
      } finally {
        finished = true;
      }
    }),
    synthesizeStop: jest.fn(),
    dispose: jest.fn(),
  };

  return {
    module,
    deliver: async (audio = new Float32Array([0.1])) => {
      await flush();
      waiting.shift()?.(audio);
      await flush();
    },
    end: async () => {
      await flush();
      waiting.shift()?.(null);
      await flush();
    },
    generatorFinished: () => finished,
  };
};

const fakePlayer = () => {
  let release!: () => void;
  const drained = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    enqueue: jest.fn(),
    finish: jest.fn(() => drained),
    stop: jest.fn(async () => release()),
    finishPlayback: () => release(),
  };
};

let appStateHandler: ((state: string) => void) | null = null;
const mockCreate = createReverbTextToSpeech as jest.Mock;
const mockPlayer = createPcmPlayer as jest.Mock;

const store = () => useReadAloudStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  appStateHandler = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _type: string,
    handler: (state: string) => void
  ) => {
    appStateHandler = handler;
    return { remove: jest.fn() };
  }) as never);
  useLLMStore.setState({
    isGenerating: false,
    isProcessingPrompt: false,
    isBenchmarking: false,
    isLoading: false,
  });
  (isReadAloudDownloaded as jest.Mock).mockResolvedValue(true);
});

afterEach(async () => {
  await store().stop();
});

describe('reading an answer aloud', () => {
  it('speaks the chunks as they arrive and releases the model when it is done', async () => {
    const run = fakeRun();
    const player = fakePlayer();
    mockCreate.mockResolvedValue(run.module);
    mockPlayer.mockReturnValue(player);

    const reading = store().toggle(7, PLAN);
    await flush();
    expect(store().messageId).toBe(7);
    expect(store().phase).toBe('preparing');
    expect(run.module.synthesize).toHaveBeenCalledWith(PLAN.text, {
      voice: PLAN.voice,
      language: PLAN.language,
    });

    await run.deliver();
    expect(store().phase).toBe('speaking');
    expect(player.enqueue).toHaveBeenCalledTimes(1);

    await run.deliver();
    expect(player.enqueue).toHaveBeenCalledTimes(2);

    await run.end();
    expect(player.finish).toHaveBeenCalled();
    expect(run.module.dispose).not.toHaveBeenCalled();

    player.finishPlayback();
    await reading;

    expect(run.module.dispose).toHaveBeenCalledTimes(1);
    expect(store().phase).toBe('idle');
    expect(store().messageId).toBeNull();
  });

  it('stops when the same message is tapped again and frees the model after the running chunk', async () => {
    const run = fakeRun();
    const player = fakePlayer();
    mockCreate.mockResolvedValue(run.module);
    mockPlayer.mockReturnValue(player);

    const reading = store().toggle(7, PLAN);
    await run.deliver();

    const stopping = store().toggle(7, PLAN);
    expect(store().phase).toBe('idle');
    expect(player.stop).toHaveBeenCalled();
    expect(run.module.synthesizeStop).toHaveBeenCalled();

    await run.deliver();
    await Promise.all([stopping, reading]);

    expect(run.generatorFinished()).toBe(true);
    expect(run.module.dispose).toHaveBeenCalledTimes(1);
    expect(player.enqueue).toHaveBeenCalledTimes(1);
  });

  it('does not start the next synthesis before the previous one has ended', async () => {
    const first = fakeRun();
    const second = fakeRun();
    mockCreate
      .mockResolvedValueOnce(first.module)
      .mockResolvedValueOnce(second.module);
    mockPlayer.mockImplementation(() => fakePlayer());

    const firstReading = store().toggle(1, PLAN);
    await first.deliver();

    const secondReading = store().toggle(2, PLAN);
    await flush();
    expect(store().messageId).toBe(2);
    expect(second.module.synthesize).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledTimes(1);

    await first.deliver();
    await flush();
    await flush();
    expect(first.module.dispose).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(second.module.synthesize).toHaveBeenCalledTimes(1);

    await second.deliver();
    expect(store().phase).toBe('speaking');
    const stopping = store().stop();
    await second.deliver();
    await Promise.all([stopping, firstReading, secondReading]);
    expect(second.module.dispose).toHaveBeenCalledTimes(1);
  });

  it('never starts while the chat model is generating or being benchmarked', async () => {
    useLLMStore.setState({ isGenerating: true });
    await store().toggle(7, PLAN);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(store().phase).toBe('idle');

    useLLMStore.setState({ isGenerating: false, isBenchmarking: true });
    await store().toggle(7, PLAN);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('stops when the chat model starts generating', async () => {
    const run = fakeRun();
    const player = fakePlayer();
    mockCreate.mockResolvedValue(run.module);
    mockPlayer.mockReturnValue(player);

    const reading = store().toggle(7, PLAN);
    await run.deliver();
    useLLMStore.setState({ isGenerating: true });
    expect(store().phase).toBe('idle');
    expect(player.stop).toHaveBeenCalled();

    await run.deliver();
    await reading;
    expect(run.module.dispose).toHaveBeenCalledTimes(1);
  });

  it('stops when the app goes to the background', async () => {
    const run = fakeRun();
    const player = fakePlayer();
    mockCreate.mockResolvedValue(run.module);
    mockPlayer.mockReturnValue(player);

    const reading = store().toggle(7, PLAN);
    await run.deliver();
    appStateHandler?.('inactive');
    expect(store().phase).toBe('speaking');
    appStateHandler?.('background');
    expect(store().phase).toBe('idle');

    await run.deliver();
    await reading;
    expect(run.module.dispose).toHaveBeenCalledTimes(1);
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it('stops when dictation claims the audio session', async () => {
    const run = fakeRun();
    mockCreate.mockResolvedValue(run.module);
    mockPlayer.mockReturnValue(fakePlayer());

    const reading = store().toggle(7, PLAN);
    await run.deliver();
    useSTTStore.getState().claimAudioSession();
    expect(store().phase).toBe('idle');

    await run.deliver();
    await reading;
  });

  it('shows download progress and cancels the download when stopped', async () => {
    (isReadAloudDownloaded as jest.Mock).mockResolvedValue(false);
    let failDownload!: (error: Error) => void;
    let reportProgress!: (progress: number) => void;
    (localReadAloudModel as jest.Mock).mockImplementationOnce(
      (_voice: string, onProgress: (progress: number) => void) => {
        reportProgress = onProgress;
        return new Promise((_resolve, reject) => {
          failDownload = reject;
        });
      }
    );

    const reading = store().toggle(7, PLAN);
    await flush();
    expect(store().phase).toBe('downloading');
    reportProgress(0.4);
    expect(store().downloadProgress).toBe(0.4);

    const stopping = store().toggle(7, PLAN);
    expect(store().phase).toBe('idle');
    expect(cancelReadAloudFetch).toHaveBeenCalledWith(
      PLAN.voice,
      expect.any(Function)
    );

    failDownload(new Error('interrupted'));
    await Promise.all([stopping, reading]);
    expect(Toast.show).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('tells the user when something goes wrong and returns to idle', async () => {
    mockCreate.mockRejectedValue(new Error('boom'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await store().toggle(7, PLAN);

    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'defaultToast' })
    );
    expect(store().phase).toBe('idle');
  });

  it('disposes a model that finished loading after the user stopped', async () => {
    const run = fakeRun();
    let finishLoading!: (module: unknown) => void;
    mockCreate.mockReturnValue(
      new Promise((resolve) => {
        finishLoading = resolve;
      })
    );

    const reading = store().toggle(7, PLAN);
    await flush();
    const stopping = store().toggle(7, PLAN);
    finishLoading(run.module);
    await Promise.all([stopping, reading]);

    expect(run.module.synthesize).not.toHaveBeenCalled();
  });
});
