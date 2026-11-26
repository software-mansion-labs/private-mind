import { AudioContext } from 'react-native-audio-api';

export interface PcmPlayer {
  enqueue: (samples: Float32Array) => void;
  finish: () => Promise<void>;
  stop: () => Promise<void>;
}

const START_NOW = 0;
const FROM_FIRST_SAMPLE = 0;

export const createPcmPlayer = (sampleRate: number): PcmPlayer => {
  const context = new AudioContext({ sampleRate });
  const queue = context.createBufferQueueSource();
  queue.connect(context.destination);

  let enqueued = 0;
  let ended = 0;
  let sealed = false;
  let stopped = false;
  let started = false;

  let settle!: () => void;
  const settled = new Promise<void>((resolve) => {
    settle = resolve;
  });

  const settleWhenDrained = () => {
    if (stopped || (sealed && ended >= enqueued)) settle();
  };

  queue.onBufferEnded = () => {
    ended += 1;
    settleWhenDrained();
  };

  const enqueue = (samples: Float32Array) => {
    if (stopped || sealed || samples.length === 0) return;
    const buffer = context.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(Float32Array.from(samples), 0);
    queue.enqueueBuffer(buffer);
    enqueued += 1;
    if (started) return;
    started = true;
    queue.start(START_NOW, FROM_FIRST_SAMPLE);
  };

  const finish = () => {
    sealed = true;
    settleWhenDrained();
    return settled;
  };

  const stop = async () => {
    if (stopped) return;
    stopped = true;
    settle();
    try {
      queue.onBufferEnded = null;
      queue.clearBuffers();
      if (started) queue.stop();
    } catch (error) {
      console.warn('Could not stop the read-aloud playback', error);
    }
    try {
      await context.close();
    } catch (error) {
      console.warn('Could not close the read-aloud audio context', error);
    }
  };

  return { enqueue, finish, stop };
};
