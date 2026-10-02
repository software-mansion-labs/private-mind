import { useCallback, useRef, useState } from 'react';
import { AudioManager, AudioRecorder } from 'react-native-audio-api';
import { OnAudioReadyEventType } from 'react-native-audio-api/lib/typescript/events/types';
import { useStableCallback } from './useStableCallback';
import { STTStore, useSTTStore } from '../store/sttStore';
import {
  type SpeechToTextModule,
  type TranscriptionResult,
} from 'react-native-executorch/legacy';

interface Options {
  onAudioData?: (data: number[]) => void;
}

type StartReturnType = Promise<AsyncGenerator<
  { committed: TranscriptionResult; nonCommitted: TranscriptionResult },
  void,
  unknown
> | null>;

export type Status = 'loading' | 'idle' | 'listening' | 'processing';

interface Result extends Pick<STTStore, 'loadProgress'> {
  start: () => StartReturnType;
  stop: () => void;
  abandon: () => void;
  status: Status;
}

const SAMPLE_RATE = 16000;
const AUDIO_LENGTH_SECONDS = 0.15;
const BUFFER_LENGTH = Math.floor(SAMPLE_RATE * AUDIO_LENGTH_SECONDS);

export function useSpeechInput({ onAudioData }: Options = {}): Result {
  const statusRef = useRef<Status>('idle');
  const [status, setStatus] = useState<Status>(statusRef.current);

  const changeStatus = useCallback((newStatus: Status) => {
    statusRef.current = newStatus;

    // echo status as state for rendering
    setStatus(newStatus);
  }, []);

  const recorder = useRef<null | AudioRecorder>(null);
  if (!recorder.current) {
    recorder.current = new AudioRecorder();
  }

  const stt = useSTTStore();

  const handleAudioData = useStableCallback(
    async ({ buffer }: OnAudioReadyEventType) => {
      try {
        const channelData = buffer.getChannelData(0);
        stt.module?.streamInsert(channelData);
        onAudioData?.(Array.from(channelData));
      } catch (error) {
        console.error('Error handling audio data:', error);
      }
    }
  );

  const isStartCanceled = useRef(false);
  const sessionClaim = useRef(0);
  const start = useCallback(async (): StartReturnType => {
    if (statusRef.current !== 'idle') return null;

    const claim = useSTTStore.getState().claimAudioSession();
    sessionClaim.current = claim;
    try {
      isStartCanceled.current = false;
      changeStatus('loading');

      AudioManager.setAudioSessionOptions({
        iosCategory: 'playAndRecord',
        iosMode: 'spokenAudio',
      });
      await AudioManager.setAudioSessionActivity(true);
      await stt.ensureLoaded();
      await closeOpenStream();

      if (isStartCanceled.current) {
        releaseAudioSession(claim);
        return null;
      }

      changeStatus('listening');
      const streamGenerator = useSTTStore.getState().module!.stream();
      throwIfRecorderFailed(
        recorder.current!.onAudioReady(
          {
            sampleRate: SAMPLE_RATE,
            bufferLength: BUFFER_LENGTH,
            channelCount: 1,
          },
          handleAudioData
        )
      );
      throwIfRecorderFailed(recorder.current!.start());

      return followToTheEnd(streamGenerator, () => changeStatus('idle'));
    } catch (error) {
      releaseAudioSession(claim);
      changeStatus('idle');
      throw error;
    }
  }, [stt, handleAudioData]);

  const stop = useCallback(async () => {
    if (statusRef.current === 'loading') {
      isStartCanceled.current = true;
      changeStatus('idle');
      return;
    }

    if (statusRef.current !== 'listening') return;

    try {
      changeStatus('processing');
      recorder.current!.stop();
      stt.module?.streamStop();
      releaseAudioSession(sessionClaim.current);
    } catch (error) {
      console.error('Error finishing audio recording:', error);
      closeAbandonedStream(stt.module);
      changeStatus('idle');
    }
  }, [stt]);

  const abandon = useCallback(() => {
    if (statusRef.current === 'idle') return;
    isStartCanceled.current = true;
    try {
      recorder.current?.stop();
    } catch (error) {
      console.error('Error stopping the recorder:', error);
    }
    closeAbandonedStream(useSTTStore.getState().module);
    releaseAudioSession(sessionClaim.current);
    changeStatus('idle');
  }, [changeStatus]);

  return {
    loadProgress: stt.loadProgress,
    start,
    stop,
    abandon,
    status,
  };
}

function throwIfRecorderFailed(
  result: { status: 'success' } | { status: 'error'; message: string } | void
) {
  if (result && result.status === 'error') {
    throw new Error(`Recorder failed: ${result.message}`);
  }
}

function releaseAudioSession(claim: number) {
  if (useSTTStore.getState().audioSessionOwner !== claim) return;
  AudioManager.setAudioSessionActivity(false);
}

function closeAbandonedStream(module: SpeechToTextModule | null) {
  try {
    module?.streamStop();
  } catch (error) {
    console.error('Error closing an abandoned transcript stream:', error);
  }
}

async function closeOpenStream() {
  const { module, streamEnd } = useSTTStore.getState();
  if (!streamEnd) return;
  closeAbandonedStream(module);
  await streamEnd;
}

async function* followToTheEnd<T>(
  source: AsyncGenerator<T, void, unknown>,
  onEnd: () => void
) {
  let settle!: () => void;
  useSTTStore.getState().trackStream(
    new Promise<void>((resolve) => {
      settle = resolve;
    })
  );

  let leftByConsumer = false;
  try {
    let next = await readFirstOrDiscardModule(source);
    while (!next.done) {
      leftByConsumer = true;
      yield next.value;
      leftByConsumer = false;
      next = await source.next();
    }
  } finally {
    if (leftByConsumer) readToTheEnd(source).then(settle);
    else settle();
  }

  onEnd();
}

async function readFirstOrDiscardModule<T>(
  source: AsyncGenerator<T, void, unknown>
) {
  try {
    return await source.next();
  } catch (error) {
    useSTTStore.getState().discardModule();
    throw error;
  }
}

async function readToTheEnd(source: AsyncGenerator<unknown, void, unknown>) {
  try {
    let next = await source.next();
    while (!next.done) next = await source.next();
  } catch (error) {
    console.error('Error closing an abandoned transcript stream:', error);
  }
}
