import { useEffect, useLayoutEffect, useState } from 'react';
import {
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import {
  GLOW_PULSE_STRENGTH,
  HIDDEN_GLOW,
  glowEndsAt,
  initialGlowSegment,
  nextGlowSegment,
  rememberGlow,
} from './thinkingGlowMotion';
import { useGlowSurface } from './ThinkingGlowHost';

interface UseThinkingGlowOptions {
  chatId: number;
  isEmpty: boolean;
  awaitingReply: boolean;
}

export const useThinkingGlow = ({
  chatId,
  isEmpty,
  awaitingReply,
}: UseThinkingGlowOptions) => {
  const still = useReducedMotion();
  const pulseStrength = still ? 0 : GLOW_PULSE_STRENGTH;

  const [tracked, setTracked] = useState(() => ({
    isEmpty,
    awaitingReply,
    pulseStrength,
    segment: initialGlowSegment(
      chatId,
      { isEmpty, awaitingReply },
      Date.now(),
      pulseStrength
    ),
  }));

  let { segment } = tracked;
  if (
    tracked.isEmpty !== isEmpty ||
    tracked.awaitingReply !== awaitingReply ||
    tracked.pulseStrength !== pulseStrength
  ) {
    segment = nextGlowSegment(
      segment,
      { isEmpty, awaitingReply },
      Date.now(),
      pulseStrength
    );
    setTracked({ isEmpty, awaitingReply, pulseStrength, segment });
  }

  useEffect(() => {
    rememberGlow(chatId, segment);
  }, [chatId, segment]);

  useEffect(() => {
    const endsAt = glowEndsAt(segment);
    if (endsAt === undefined) return;
    const timer = setTimeout(
      () => setTracked((current) => ({ ...current, segment: HIDDEN_GLOW })),
      Math.max(0, endsAt - Date.now())
    );
    return () => clearTimeout(timer);
  }, [segment]);

  const surface = useGlowSurface();
  const ownSegment = useSharedValue(segment);
  const segmentValue = surface?.segment ?? ownSegment;
  useLayoutEffect(() => {
    segmentValue.set(segment);
  }, [segment, segmentValue]);

  const visible = segment.kind !== 'hidden';
  const ownClock = useSharedValue(Date.now());
  const clock = surface?.clock ?? ownClock;
  const ticker = useFrameCallback(() => {
    clock.set(Date.now());
  }, visible);
  useEffect(() => {
    ticker.setActive(visible);
  }, [ticker, visible]);
};
