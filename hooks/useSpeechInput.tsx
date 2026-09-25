import { useCallback, useRef, useState } from 'react';
import { AudioManager, AudioRecorder } from 'react-native-audio-api';
import { OnAudioReadyEventType } from 'react-native-audio-api/lib/typescript/events/types';
import { useStableCallback } from './useStableCallback';
import { STTStore, useSTTStore } from '../store/sttStore';
import {
  type SpeechToTextModule,
  type TranscriptionResult,
} from 'react-native-executorch';

interface Options {
  onAudioData?: (data: number[]) => void;
}

type StartReturnType = Promise<AsyncGenerator<
  { committed: TranscriptionResult; nonCommitted: TranscriptionResult },
  void,
  unknown
> | null>;

type Status = 'loading' | 'idle' | 'listening' | 'processing';

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
  const start = useCallback(async (): StartReturnType => {
    if (statusRef.current !== 'idle') return null;

    try {
      isStartCanceled.current = false;
      changeStatus('loading');

      AudioManager.setAudioSessionOptions({
        iosCategory: 'playAndRecord',
        iosMode: 'spokenAudio',
      });
      await AudioManager.setAudioSessionActivity(true);
      await stt.ensureLoaded();

      if (isStartCanceled.current) {
        return null;
      }

      changeStatus('listening');
      const store = useSTTStore.getState();
      const module = store.module;
      if (store.streamOpen) {
        closeAbandonedStream(module);
      }

      let streamGenerator;
      try {
        streamGenerator = module!.stream();
      } catch (error) {
        useSTTStore.getState().discardModule();
        throw error;
      }
      useSTTStore.getState().markStreamOpen();
      recorder.current!.onAudioReady(
        {
          sampleRate: SAMPLE_RATE,
          bufferLength: BUFFER_LENGTH,
          channelCount: 1,
        },
        handleAudioData
      );
      recorder.current!.start();

      return onGeneratorEnd(streamGenerator, () => {
        useSTTStore.getState().markStreamClosed();
        changeStatus('idle');
      });
    } catch (error) {
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
      AudioManager.setAudioSessionActivity(false);
    } catch (error) {
      console.error('Error finishing audio recording:', error);
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
    AudioManager.setAudioSessionActivity(false);
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

function closeAbandonedStream(module: SpeechToTextModule | null) {
  try {
    module?.streamStop();
  } catch (error) {
    console.error('Error closing an abandoned transcript stream:', error);
  }
  useSTTStore.getState().markStreamClosed();
}

async function* onGeneratorEnd<T>(
  generator: AsyncGenerator<T, void, unknown>,
  callback: () => void
) {
  for await (const item of generator) {
    yield item;
  }

  callback();
}
