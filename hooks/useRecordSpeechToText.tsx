import { useCallback, useRef, useState } from 'react';
import { AudioManager, AudioRecorder } from 'react-native-audio-api';
import {
  STREAMING_ACTION,
  useSpeechToText,
  WHISPER_TINY_DECODER,
  WHISPER_TINY_ENCODER,
  WHISPER_TOKENIZER,
} from 'react-native-executorch';
import { OnAudioReadyEventType } from 'react-native-audio-api/lib/typescript/events/types';
import Toast from 'react-native-toast-message';

interface Result
  extends Pick<
    ReturnType<typeof useSpeechToText>,
    'isReady' | 'sequence' | 'error'
  > {
  start: () => void;
  stop: () => Promise<string | null>;
  status: 'idle' | 'listening' | 'processing';
}

const SAMPLE_RATE = 16000;
const AUDIO_LENGTH_SECONDS = 1;
const BUFFER_LENGTH = SAMPLE_RATE * AUDIO_LENGTH_SECONDS;

export function useRecordSpeechToText(): Result {
  const [status, setStatus] = useState<Result['status']>('idle');

  const recorder = useRef(
    new AudioRecorder({
      sampleRate: SAMPLE_RATE,
      bufferLengthInSamples: BUFFER_LENGTH,
    })
  );

  const stt = useSpeechToText({
    modelName: 'whisper',

    // encoderSource: WHISPER_TINY_ENCODER,
    encoderSource: require('../assets/models/whisper-en/encoder.pte'),

    // decoderSource: WHISPER_TINY_DECODER,
    decoderSource: require('../assets/models/whisper-en/decoder.pte'),

    // tokenizerSource: WHISPER_TOKENIZER,
    tokenizerSource: require('../assets/models/whisper-en/tokenizer.json'),
  });

  const handleAudioData = useCallback(
    async ({ buffer }: OnAudioReadyEventType) => {
      try {
        const bufferArray = Array.from(buffer.getChannelData(0));

        await stt.streamingTranscribe(STREAMING_ACTION.DATA, bufferArray);
      } catch (error) {
        console.error('Error handling audio data:', error);
      }
    },
    [stt]
  );

  const start = useCallback(async () => {
    if (status !== 'idle') return;

    try {
      const permissionStatus = await AudioManager.requestRecordingPermissions();
      if (permissionStatus !== 'Granted') {
        Toast.show({
          type: 'defaultToast',
          text1: 'Microphone permission is required to record messages.',
        });
        return;
      }

      setStatus('listening');

      AudioManager.setAudioSessionOptions({
        iosCategory: 'playAndRecord',
        iosMode: 'spokenAudio',
      });

      await stt.streamingTranscribe(STREAMING_ACTION.START);

      recorder.current.onAudioReady(handleAudioData);
      recorder.current.start();
    } catch (error) {
      console.error('Error starting audio recording:', error);
      setStatus('idle');
    }
  }, [status, stt, handleAudioData]);

  const stop = useCallback(async () => {
    try {
      if (status !== 'listening') return null;

      setStatus('processing');

      recorder.current.stop();
      const transcriptionResult = await stt.streamingTranscribe(
        STREAMING_ACTION.STOP
      );

      setStatus('idle');
      return transcriptionResult;
    } catch (error) {
      console.error('Error finishing audio recording:', error);
      setStatus('idle');
      return null;
    }
  }, [status, stt]);

  return {
    start,
    stop,
    status,
    isReady: stt.isReady,
    sequence: stt.sequence,
    error: stt.error,
  };
}
