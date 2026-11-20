export const AudioManager = {
  requestRecordingPermissions: jest.fn(() => Promise.resolve('Granted')),
  setAudioSessionOptions: jest.fn(),
  setAudioSessionActivity: jest.fn(() => Promise.resolve()),
};

export class AudioRecorder {
  onAudioReady = jest.fn();
  start = jest.fn();
  stop = jest.fn();
}

export class FakeBufferQueueSource {
  onBufferEnded: ((event: unknown) => void) | null = null;
  connect = jest.fn();
  enqueueBuffer = jest.fn(() => 'buffer');
  clearBuffers = jest.fn();
  start = jest.fn();
  stop = jest.fn();
}

export class AudioContext {
  static lastQueue: FakeBufferQueueSource | null = null;
  destination = {};
  close = jest.fn(() => Promise.resolve());
  createBuffer = jest.fn((_channels: number, length: number) => ({
    length,
    copyToChannel: jest.fn(),
  }));
  createBufferQueueSource = jest.fn(() => {
    const queue = new FakeBufferQueueSource();
    AudioContext.lastQueue = queue;
    return queue;
  });
}
