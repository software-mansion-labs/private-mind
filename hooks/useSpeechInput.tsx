import { useCallback, useRef, useState } from 'react';
import { AudioManager, AudioRecorder } from 'react-native-audio-api';
import {
  SpeechToTextModelConfig,
  useSpeechToText,
} from 'react-native-executorch';
import { OnAudioReadyEventType } from 'react-native-audio-api/lib/typescript/events/types';
import { useStableCallback } from './useStableCallback';

interface Options {
  onAudioData?: (data: number[]) => void;
}

interface Result
  extends Pick<
    ReturnType<typeof useSpeechToText>,
    | 'downloadProgress'
    | 'committedTranscription'
    | 'nonCommittedTranscription'
    | 'error'
  > {
  start: () => Promise<string | null>;
  stop: () => void;
  status: 'loading' | 'idle' | 'listening' | 'processing';
}

const SAMPLE_RATE = 16000;
const AUDIO_LENGTH_SECONDS = 0.15;
const BUFFER_LENGTH = Math.floor(SAMPLE_RATE * AUDIO_LENGTH_SECONDS);

const WHISPER_TINY_EN_ASSETS: SpeechToTextModelConfig = {
  decoderSource: require('../assets/models/whisper-tiny-en/whisper_tiny_en_decoder_xnnpack.pte'),
  encoderSource: require('../assets/models/whisper-tiny-en/whisper_tiny_en_encoder_xnnpack.pte'),
  tokenizerSource: require('../assets/models/whisper-tiny-en/tokenizer.json'),
  isMultilingual: false,
};

export function useSpeechInput({ onAudioData }: Options = {}): Result {
  const [listeningStatus, setListeningStatus] =
    useState<Result['status']>('idle');

  const recorder = useRef<null | AudioRecorder>(null);
  if (!recorder.current) {
    recorder.current = new AudioRecorder({
      sampleRate: SAMPLE_RATE,
      bufferLengthInSamples: BUFFER_LENGTH,
    });
  }

  const stt = useSpeechToText({ model: WHISPER_TINY_EN_ASSETS });
  const status = stt.isReady ? listeningStatus : 'loading';

  const handleAudioData = useStableCallback(
    async ({ buffer }: OnAudioReadyEventType) => {
      try {
        const bufferArray = Array.from(buffer.getChannelData(0));
        stt.streamInsert(bufferArray);
        onAudioData?.(bufferArray);
      } catch (error) {
        console.error('Error handling audio data:', error);
      }
    }
  );

  const start = useCallback(async (): Promise<string | null> => {
    if (status !== 'idle') return null;

    try {
      setListeningStatus('listening');

      AudioManager.setAudioSessionOptions({
        iosCategory: 'playAndRecord',
        iosMode: 'spokenAudio',
      });

      const streamPromise = stt.stream();
      recorder.current!.onAudioReady(handleAudioData);
      recorder.current!.start();

      const transcription = await streamPromise;
      setListeningStatus('idle');
      return transcription;
    } catch (error) {
      console.error('Error starting audio recording:', error);
      setListeningStatus('idle');
      return null;
    }
  }, [status, stt, handleAudioData]);

  const stop = useCallback(async () => {
    try {
      if (status !== 'listening') return null;

      setListeningStatus('processing');
      recorder.current!.stop();
      stt.streamStop();
    } catch (error) {
      console.error('Error finishing audio recording:', error);
      setListeningStatus('idle');
    }
  }, [status, stt]);

  return {
    downloadProgress: stt.downloadProgress,
    error: stt.error,
    committedTranscription: stt.committedTranscription,
    nonCommittedTranscription: stt.nonCommittedTranscription,
    start,
    stop,
    status,
  };
}
