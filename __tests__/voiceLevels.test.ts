import { voiceLevels, withSpeechSway } from '../utils/voiceLevels';

const SAMPLE_RATE = 16000;
const CHUNK = 2400;

const tone = (hz: number, amplitude: number) =>
  Array.from(
    { length: CHUNK },
    (_, i) => amplitude * Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE)
  );

describe('voiceLevels', () => {
  it('splits a chunk into the requested number of slices', () => {
    expect(voiceLevels(tone(440, 0.1), SAMPLE_RATE, 3)).toHaveLength(3);
  });

  it('reads silence as nothing at all', () => {
    const [slice] = voiceLevels(new Array(CHUNK).fill(0), SAMPLE_RATE, 1);

    expect(slice).toEqual({ level: 0, low: 0, mid: 0, high: 0 });
  });

  it('ignores the faint peaks of a quiet room', () => {
    const [slice] = voiceLevels(tone(440, 0.02), SAMPLE_RATE, 1);

    expect(slice.level).toBe(0);
  });

  it('lifts loud speech to most of full height', () => {
    const [slice] = voiceLevels(tone(440, 0.2), SAMPLE_RATE, 1);

    expect(slice.level).toBeGreaterThan(0.75);
  });

  it('lifts quiet speech to at least a quarter of full height', () => {
    const [slice] = voiceLevels(tone(440, 0.05), SAMPLE_RATE, 1);

    expect(slice.level).toBeGreaterThanOrEqual(0.25);
  });

  it('lifts ordinary speech to about half of full height', () => {
    const [slice] = voiceLevels(tone(440, 0.1), SAMPLE_RATE, 1);

    expect(slice.level).toBeGreaterThan(0.5);
  });

  it('reads louder speech as a higher level', () => {
    const [quiet] = voiceLevels(tone(440, 0.01), SAMPLE_RATE, 1);
    const [loud] = voiceLevels(tone(440, 0.2), SAMPLE_RATE, 1);

    expect(loud.level).toBeGreaterThan(quiet.level);
  });

  it('puts a deep voice in the low band and a hiss in the high band', () => {
    const [deep] = voiceLevels(tone(120, 0.2), SAMPLE_RATE, 1);
    const [hiss] = voiceLevels(tone(5000, 0.2), SAMPLE_RATE, 1);

    expect(deep.low).toBeGreaterThan(deep.high);
    expect(hiss.high).toBeGreaterThan(hiss.low);
  });

  it('never reports more than full scale', () => {
    const [clipped] = voiceLevels(tone(440, 1.5), SAMPLE_RATE, 1);

    expect(
      Math.max(clipped.level, clipped.low, clipped.mid, clipped.high)
    ).toBeLessThanOrEqual(1);
  });
});

describe('withSpeechSway', () => {
  const steady = (value: number) => ({
    level: value,
    low: value,
    mid: value,
    high: value,
  });
  const moments = [0, 0.3, 0.7, 1.1, 1.6, 2.2];
  const swayRange = (value: number) => {
    const heights = moments.map(
      (seconds) => withSpeechSway(steady(value), seconds).level
    );
    return Math.max(...heights) - Math.min(...heights);
  };

  it('shows nothing in silence', () => {
    for (const seconds of moments) {
      expect(withSpeechSway(steady(0), seconds)).toEqual(steady(0));
    }
  });

  it('moves the dome while someone keeps talking at one level', () => {
    expect(swayRange(0.4)).toBeGreaterThan(0.1);
  });

  it('moves more for louder speech', () => {
    expect(swayRange(0.6)).toBeGreaterThan(swayRange(0.2));
  });

  it('stays between nothing and full height', () => {
    for (const seconds of moments) {
      const swayed = withSpeechSway(steady(1), seconds);
      const values = [swayed.level, swayed.low, swayed.mid, swayed.high];
      expect(Math.max(...values)).toBeLessThanOrEqual(1);
      expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    }
  });
});
