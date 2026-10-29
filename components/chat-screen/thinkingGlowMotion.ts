export type Rgb = readonly [number, number, number];

export const GLOW_COLOURS: readonly [Rgb, Rgb, Rgb] = [
  [0x3d, 0x61, 0xd6],
  [0x4c, 0x5b, 0xe0],
  [0x8b, 0x7c, 0xf0],
];

export const GLOW_TIMING = {
  riseMs: 1300,
  settleMs: 600,
  leaveMs: 320,
  liftMs: 1060,
  answerMs: 730,
  fadeMs: 1000,
  pulsePeriodMs: 3400,
  pulseFadeInMs: 600,
  thinkFirstShiftMs: 1400,
  thinkSwingMs: 1700,
} as const;

export const GLOW_PULSE_STRENGTH = 0.64;
export const GLOW_INTENSITY = 0.72;
export const GLOW_DARK_BOOST = 1.25;

export const GLOW_REST = { cy: 0.6, thick: 0.42 };
const RISE_FROM_CY = 1.3;
const THINK = { cy: 0.88, thick: 0.45, cyWobble: 0.012, thickWobble: 0.03 };
const FLARE = { cy: 0.84, thick: 0.5, peak: 0.15 };
const FADE_END_CY = 1.05;
const FADE_SPREAD = 0.14;
const PULSE_RISE = 0.012;
const PULSE_SWELL = 0.25;
const PULSE_TINT = 0.35;
const ANSWER_LIGHTEN = 0.45;
const WHITE: Rgb = [255, 255, 255];

export type GlowFrame = {
  cy: number;
  thick: number;
  alpha: number;
  pulse: number;
  rise: number;
  colour: Rgb;
};

export type GlowSegment =
  | { kind: 'hidden' }
  | { kind: 'open'; at: number }
  | { kind: 'settle'; at: number; from: GlowFrame }
  | { kind: 'send'; at: number; from: GlowFrame }
  | { kind: 'answer'; at: number; from: GlowFrame }
  | { kind: 'leave'; at: number; from: GlowFrame };

export type GlowInput = { isEmpty: boolean; awaitingReply: boolean };

export const HIDDEN_GLOW: GlowSegment = { kind: 'hidden' };

const clamp01 = (x: number) => {
  'worklet';
  return Math.max(0, Math.min(1, x));
};

const lerp = (a: number, b: number, t: number) => {
  'worklet';
  return a + (b - a) * t;
};

const smooth = (from: number, to: number, x: number) => {
  'worklet';
  const t = clamp01((x - from) / (to - from));
  return t * t * (3 - 2 * t);
};

const easeOutCubic = (x: number) => {
  'worklet';
  return 1 - Math.pow(1 - x, 3);
};

const easeInOutSine = (x: number) => {
  'worklet';
  return (1 - Math.cos(Math.PI * x)) / 2;
};

const easeInOutCubic = (x: number) => {
  'worklet';
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => {
  'worklet';
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
};

const mixFrames = (a: GlowFrame, b: GlowFrame, t: number): GlowFrame => {
  'worklet';
  return {
    cy: lerp(a.cy, b.cy, t),
    thick: lerp(a.thick, b.thick, t),
    alpha: lerp(a.alpha, b.alpha, t),
    pulse: lerp(a.pulse, b.pulse, t),
    rise: lerp(a.rise, b.rise, t),
    colour: mixRgb(a.colour, b.colour, t),
  };
};

export const pulseAt = (sinceRestMs: number, strength: number) => {
  'worklet';
  const breath =
    (1 - Math.cos((2 * Math.PI * sinceRestMs) / GLOW_TIMING.pulsePeriodMs)) / 2;
  return strength * smooth(0, GLOW_TIMING.pulseFadeInMs, sinceRestMs) * breath;
};

const restFrame = (sinceRestMs: number, pulseStrength: number): GlowFrame => {
  'worklet';
  const w = pulseAt(sinceRestMs, pulseStrength);
  return {
    cy: GLOW_REST.cy - PULSE_RISE * w,
    thick: GLOW_REST.thick * (1 + PULSE_SWELL * w),
    alpha: 1 + PULSE_SWELL * w,
    pulse: w,
    rise: 1,
    colour: mixRgb(GLOW_COLOURS[0], GLOW_COLOURS[1], PULSE_TINT * w),
  };
};

const riseFrame = (sinceOpenMs: number, pulseStrength: number): GlowFrame => {
  'worklet';
  const rest = restFrame(sinceOpenMs, pulseStrength);
  const u = clamp01(sinceOpenMs / GLOW_TIMING.riseMs);
  return {
    ...rest,
    cy: lerp(RISE_FROM_CY, rest.cy, easeOutCubic(u)),
    alpha: rest.alpha * smooth(0, 0.4, u),
    rise: u,
  };
};

const thinkColour = (sinceThinkMs: number): Rgb => {
  'worklet';
  const { thinkFirstShiftMs, thinkSwingMs } = GLOW_TIMING;
  if (sinceThinkMs < thinkFirstShiftMs) {
    return mixRgb(
      GLOW_COLOURS[0],
      GLOW_COLOURS[1],
      smooth(0, 1, sinceThinkMs / thinkFirstShiftMs)
    );
  }
  const swing =
    (1 -
      Math.cos(((sinceThinkMs - thinkFirstShiftMs) / thinkSwingMs) * Math.PI)) /
    2;
  return mixRgb(GLOW_COLOURS[1], GLOW_COLOURS[2], swing);
};

const thinkFrame = (sinceThinkMs: number): GlowFrame => {
  'worklet';
  return {
    cy: THINK.cy + THINK.cyWobble * Math.sin(sinceThinkMs / 900),
    thick: THINK.thick + THINK.thickWobble * Math.sin(sinceThinkMs / 1300),
    alpha: 1,
    pulse: 0,
    rise: 1,
    colour: thinkColour(sinceThinkMs),
  };
};

export const answerColour = (replyStartColour: Rgb): Rgb => {
  'worklet';
  return mixRgb(replyStartColour, WHITE, ANSWER_LIGHTEN);
};

const answerFrame = (from: GlowFrame, sinceAnswerMs: number): GlowFrame => {
  'worklet';
  const { answerMs, fadeMs } = GLOW_TIMING;
  const lit = answerColour(from.colour);
  if (sinceAnswerMs < answerMs) {
    const u = sinceAnswerMs / answerMs;
    const k = easeOutCubic(u);
    return {
      cy: lerp(from.cy, FLARE.cy, u),
      thick: lerp(from.thick, FLARE.thick, u),
      alpha: lerp(from.alpha, 1, u) + FLARE.peak * Math.sin(Math.PI * u),
      pulse: from.pulse * (1 - u),
      rise: lerp(from.rise, 1, u),
      colour: mixRgb(from.colour, lit, k),
    };
  }
  const u = clamp01((sinceAnswerMs - answerMs) / fadeMs);
  return {
    cy: lerp(FLARE.cy, FADE_END_CY, easeInOutSine(u)),
    thick: FLARE.thick + FADE_SPREAD * easeInOutSine(u),
    alpha: 1 - easeInOutSine(u),
    pulse: 0,
    rise: 1,
    colour: lit,
  };
};

const HIDDEN_FRAME: GlowFrame = {
  cy: GLOW_REST.cy,
  thick: GLOW_REST.thick,
  alpha: 0,
  pulse: 0,
  rise: 1,
  colour: GLOW_COLOURS[0],
};

export const glowFrameAt = (
  segment: GlowSegment,
  now: number,
  pulseStrength: number
): GlowFrame => {
  'worklet';
  if (segment.kind === 'hidden') return HIDDEN_FRAME;
  const t = Math.max(0, now - segment.at);
  switch (segment.kind) {
    case 'open':
      return riseFrame(t, pulseStrength);
    case 'settle': {
      const rest = restFrame(t, pulseStrength);
      return t < GLOW_TIMING.settleMs
        ? mixFrames(
            segment.from,
            rest,
            easeInOutCubic(t / GLOW_TIMING.settleMs)
          )
        : rest;
    }
    case 'send':
      return t < GLOW_TIMING.liftMs
        ? mixFrames(
            segment.from,
            thinkFrame(0),
            easeInOutCubic(t / GLOW_TIMING.liftMs)
          )
        : thinkFrame(t - GLOW_TIMING.liftMs);
    case 'answer':
      return answerFrame(segment.from, t);
    case 'leave': {
      const u = clamp01(t / GLOW_TIMING.leaveMs);
      return {
        ...segment.from,
        alpha: segment.from.alpha * (1 - easeInOutCubic(u)),
        pulse: segment.from.pulse * (1 - u),
      };
    }
  }
};

export const isGlowResting = (segment: GlowSegment) =>
  segment.kind === 'open' || segment.kind === 'settle';

export const nextGlowSegment = (
  current: GlowSegment,
  { isEmpty, awaitingReply }: GlowInput,
  now: number,
  pulseStrength: number
): GlowSegment => {
  const from = () => glowFrameAt(current, now, pulseStrength);
  if (isEmpty) {
    if (isGlowResting(current)) return current;
    if (current.kind === 'hidden') return { kind: 'open', at: now };
    return { kind: 'settle', at: now, from: from() };
  }
  if (awaitingReply) {
    return isGlowResting(current)
      ? { kind: 'send', at: now, from: from() }
      : current;
  }
  if (isGlowResting(current) || current.kind === 'send') {
    return { kind: 'answer', at: now, from: from() };
  }
  return current;
};

export const glowEndsAt = (segment: GlowSegment): number | undefined => {
  if (segment.kind === 'answer') {
    return segment.at + GLOW_TIMING.answerMs + GLOW_TIMING.fadeMs;
  }
  if (segment.kind === 'leave') return segment.at + GLOW_TIMING.leaveMs;
  return undefined;
};

let handoff: { chatId: number; segment: GlowSegment } | null = null;

export const rememberGlow = (chatId: number, segment: GlowSegment): void => {
  handoff = { chatId, segment };
};

export const initialGlowSegment = (
  chatId: number,
  input: GlowInput,
  now: number,
  pulseStrength: number
): GlowSegment => {
  if (handoff && isGlowResting(handoff.segment)) {
    return input.isEmpty
      ? handoff.segment
      : {
          kind: 'leave',
          at: now,
          from: glowFrameAt(handoff.segment, now, pulseStrength),
        };
  }
  if (handoff?.chatId === chatId) {
    return nextGlowSegment(handoff.segment, input, now, pulseStrength);
  }
  return input.isEmpty ? { kind: 'open', at: now } : HIDDEN_GLOW;
};

export const forgetGlow = (): void => {
  handoff = null;
};
