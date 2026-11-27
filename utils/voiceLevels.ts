export interface VoiceLevels {
  level: number;
  low: number;
  mid: number;
  high: number;
}

export const SILENT_VOICE: VoiceLevels = { level: 0, low: 0, mid: 0, high: 0 };

const LOW_CUTOFF_HZ = 300;
const HIGH_CUTOFF_HZ = 2000;

const onePoleCoefficient = (cutoffHz: number, sampleRate: number) =>
  1 - Math.exp((-2 * Math.PI * cutoffHz) / sampleRate);

const ROOM_NOISE_DB = -32;
const FULL_HEIGHT_DB = -10;

const decibels = (peak: number) => 20 * Math.log10(Math.max(peak, 1e-6));

const fullScale = (peak: number) =>
  Math.min(
    1,
    Math.max(
      0,
      (decibels(peak) - ROOM_NOISE_DB) / (FULL_HEIGHT_DB - ROOM_NOISE_DB)
    )
  );

export function voiceLevels(
  samples: ArrayLike<number>,
  sampleRate: number,
  windows: number
): VoiceLevels[] {
  const lowStep = onePoleCoefficient(LOW_CUTOFF_HZ, sampleRate);
  const highStep = onePoleCoefficient(HIGH_CUTOFF_HZ, sampleRate);
  const windowLength = Math.max(1, Math.floor(samples.length / windows));
  let belowLow = 0;
  let belowHigh = 0;
  const result: VoiceLevels[] = [];

  for (let w = 0; w < windows; w++) {
    const start = w * windowLength;
    const end = w === windows - 1 ? samples.length : start + windowLength;
    let all = 0;
    let low = 0;
    let mid = 0;
    let high = 0;
    for (let i = start; i < end; i++) {
      const x = samples[i];
      belowLow += lowStep * (x - belowLow);
      belowHigh += highStep * (x - belowHigh);
      all = Math.max(all, Math.abs(x));
      low = Math.max(low, Math.abs(belowLow));
      mid = Math.max(mid, Math.abs(belowHigh - belowLow));
      high = Math.max(high, Math.abs(x - belowHigh));
    }
    result.push({
      level: fullScale(all),
      low: fullScale(low),
      mid: fullScale(mid),
      high: fullScale(high),
    });
  }
  return result;
}

const SWAY = 0.3;
const BREATHS_PER_SECOND = 0.6;

export function withSpeechSway(
  heard: VoiceLevels,
  seconds: number
): VoiceLevels {
  'worklet';
  const sway = (value: number, phase: number, pace: number) =>
    Math.min(
      1,
      value *
        (1 +
          SWAY *
            Math.sin(2 * Math.PI * BREATHS_PER_SECOND * pace * seconds + phase))
    );
  return {
    level: sway(heard.level, 0, 1),
    low: sway(heard.low, 1.7, 0.83),
    mid: sway(heard.mid, 3.1, 1.21),
    high: sway(heard.high, 4.6, 0.67),
  };
}
