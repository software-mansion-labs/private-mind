import { AudioContext } from 'react-native-audio-api';
import { createPcmPlayer } from '../utils/pcmPlayer';

const lastQueue = () =>
  (AudioContext as unknown as { lastQueue: any }).lastQueue;

const chunk = () => new Float32Array([0.1, 0.2, 0.3]);

describe('createPcmPlayer', () => {
  it('starts the queue with the first chunk only', () => {
    const player = createPcmPlayer(24000);
    player.enqueue(chunk());
    player.enqueue(chunk());
    expect(lastQueue().enqueueBuffer).toHaveBeenCalledTimes(2);
    expect(lastQueue().start).toHaveBeenCalledTimes(1);
    expect(lastQueue().start).toHaveBeenCalledWith(0, 0);
  });

  it('finishes only once every queued buffer has ended', async () => {
    const player = createPcmPlayer(24000);
    player.enqueue(chunk());
    player.enqueue(chunk());
    let finished = false;
    const done = player.finish().then(() => {
      finished = true;
    });

    lastQueue().onBufferEnded({ isLastBufferInQueue: true });
    await Promise.resolve();
    expect(finished).toBe(false);

    lastQueue().onBufferEnded({ isLastBufferInQueue: true });
    await done;
    expect(finished).toBe(true);
  });

  it('does not treat a starved queue as the end while more may come', async () => {
    const player = createPcmPlayer(24000);
    player.enqueue(chunk());
    lastQueue().onBufferEnded({ isLastBufferInQueue: true });
    player.enqueue(chunk());
    let finished = false;
    const done = player.finish().then(() => {
      finished = true;
    });
    await Promise.resolve();
    expect(finished).toBe(false);
    lastQueue().onBufferEnded({ isLastBufferInQueue: true });
    await done;
  });

  it('finishes at once when nothing was queued', async () => {
    const player = createPcmPlayer(24000);
    await expect(player.finish()).resolves.toBeUndefined();
  });

  it('stop releases a pending finish, silences the queue and closes the context', async () => {
    const player = createPcmPlayer(24000);
    player.enqueue(chunk());
    const done = player.finish();
    await player.stop();
    await done;
    expect(lastQueue().clearBuffers).toHaveBeenCalled();
    expect(lastQueue().stop).toHaveBeenCalled();
  });

  it('ignores chunks queued after stop', async () => {
    const player = createPcmPlayer(24000);
    await player.stop();
    player.enqueue(chunk());
    expect(lastQueue().enqueueBuffer).not.toHaveBeenCalled();
  });

  it('can be stopped twice', async () => {
    const player = createPcmPlayer(24000);
    await player.stop();
    await expect(player.stop()).resolves.toBeUndefined();
  });
});
