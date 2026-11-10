import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Keyboard, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { isDarkTheme } from '../../styles/colors';
import { NEW_CHAT_REST_BOTTOM_FRACTION } from '../../constants/chat-screen';
import { useSplashFinished } from '../../utils/splashState';
import ParticleSwarm from '../swarm/ParticleSwarm';
import { HEADING_OUTLINES } from '../swarm/headingOutlines';
import type { HeadingAnchor } from './useHeadingAnchor';
import { GRADIENT_EXIT_MS } from './gradientHandoff';

const REFERENCE_SCREEN_HEIGHT = 844;
const SPHERE_RADIUS = 95;
const DOT_SIZE = 1.7;
const DRIFT_DISTANCE = 36;
const DOTS_SECONDS = 3;
const DOTS_INTO_TEXT_SECONDS = 4.4;
const HEADING_REVEAL_RANGE = [0.84, 0.95];
const HEADING_MIDDLE_EM = 0.35;
const BADGE_FADE_IN_MS = 450;
const CANVAS_OVERSCAN_RADII = 3;

const BLOOM_PEAK_OPACITY = 0.6;
const BLOOM_RISE_SHARE = 0.8;
const BLOOM_FALL_SHARE = 0.85;
const MS_PER_SECOND = 1000;
const BLOOM_HEIGHT_FRACTION = 520 / REFERENCE_SCREEN_HEIGHT;
const BLOOM_EASING = Easing.inOut(Easing.quad);
const BLOOM_LOCATIONS = [0, 0.5, 1] as const;
const BLOOM_COLORS_LIGHT = [
  'rgba(61,97,214,0)',
  'rgba(61,97,214,0.28)',
  'rgba(61,97,214,0.62)',
] as const;
const BLOOM_COLORS_DARK = [
  'rgba(61,97,214,0)',
  'rgba(61,97,214,0.4)',
  'rgba(61,97,214,0.85)',
] as const;

const KEYBOARD_FADE_DISTANCE = 60;

const PALETTE_LIGHT = {
  backColor: [0.66, 0.73, 0.95],
  frontColor: [0.239, 0.38, 0.839],
  highlightColor: [0.118, 0.247, 0.706],
  backAlpha: 0.2,
  additive: false,
} as const;
const PALETTE_DARK = {
  backColor: [0.2, 0.3, 0.68],
  frontColor: [0.43, 0.56, 1],
  highlightColor: [0.75, 0.82, 1],
  backAlpha: 0.3,
  additive: true,
} as const;

export const SWARM_CLEARANCE_WITH_PROMPTS = 25;
export const SWARM_CLEARANCE_WITH_DESCRIPTION = 84;

export const swarmGeometry = (
  screenHeight: number,
  headingClearance: number,
  logoCenterY?: number
) => {
  const scale = Math.min(1, screenHeight / REFERENCE_SCREEN_HEIGHT);
  const radius = SPHERE_RADIUS * scale;
  const centerY =
    logoCenterY ??
    screenHeight * NEW_CHAT_REST_BOTTOM_FRACTION + headingClearance + radius;
  const overscan = radius * CANVAS_OVERSCAN_RADII;
  const canvasTop = Math.max(0, centerY - overscan);
  const canvasBottom = Math.min(screenHeight, centerY + overscan);
  return {
    scale,
    radius,
    canvasTop,
    canvasHeight: canvasBottom - canvasTop,
    centerInCanvas: centerY - canvasTop,
  };
};

export const useSwarmOncePerNewChat = (
  active: boolean,
  newChatStarts: number
): boolean => {
  const [spentFor, setSpentFor] = useState<number | null>(null);
  const startedFor = useRef<number | null>(null);
  useEffect(() => {
    if (active) startedFor.current = newChatStarts;
    else if (startedFor.current === newChatStarts) setSpentFor(newChatStarts);
  }, [active, newChatStarts]);
  return active && spentFor !== newChatStarts;
};

interface Props {
  screenHeight: number;
  headingClearance: number;
  keyboardLift?: SharedValue<number>;
  heading?: string;
  headingAnchor?: HeadingAnchor | null;
  headingReveal?: SharedValue<number>;
  badgeReveal?: SharedValue<number>;
}

const NewChatSwarm = ({
  screenHeight,
  headingClearance,
  keyboardLift,
  heading,
  headingAnchor,
  headingReveal,
  badgeReveal,
}: Props) => {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [dotsDone, setDotsDone] = useState(false);
  const [bloomDone, setBloomDone] = useState(false);
  const [keyboardWasOpen] = useState(() => Keyboard.isVisible());
  const skipped = reducedMotion || keyboardWasOpen;
  const dark = isDarkTheme(theme);
  const splashFinished = useSplashFinished();
  const outline = heading ? HEADING_OUTLINES[heading] : undefined;
  const measuringHeading = !!outline && headingAnchor === undefined;
  const formsText = !!outline && !!headingAnchor;
  const durationSeconds = formsText ? DOTS_INTO_TEXT_SECONDS : DOTS_SECONDS;
  const progress = useSharedValue(0);
  const logoCenterY =
    outline && headingAnchor
      ? headingAnchor.baseline -
        (headingAnchor.width / outline.advance) * HEADING_MIDDLE_EM
      : undefined;

  useLayoutEffect(() => {
    const hidden = skipped || !outline ? 1 : 0;
    headingReveal?.set(hidden);
    badgeReveal?.set(hidden);
    return () => {
      headingReveal?.set(1);
      badgeReveal?.set(1);
    };
  }, [badgeReveal, headingReveal, outline, skipped]);

  useEffect(() => {
    if (headingAnchor !== null) return;
    headingReveal?.set(1);
    badgeReveal?.set(1);
  }, [badgeReveal, headingAnchor, headingReveal]);

  const handleKeyboardTookOver = useCallback(() => {
    progress.set(1);
    headingReveal?.set(1);
    badgeReveal?.set(1);
    setDotsDone(true);
    setBloomDone(true);
  }, [badgeReveal, headingReveal, progress]);

  useAnimatedReaction(
    () => ({
      dots: progress.get(),
      keyboard: keyboardLift
        ? interpolate(
            keyboardLift.get(),
            [-KEYBOARD_FADE_DISTANCE, 0],
            [1, 0],
            'clamp'
          )
        : 0,
    }),
    ({ dots, keyboard }, previous) => {
      if (formsText && headingReveal) {
        headingReveal.set(
          Math.max(
            interpolate(dots, HEADING_REVEAL_RANGE, [0, 1], 'clamp'),
            keyboard
          )
        );
      }
      if (keyboard > 0 && badgeReveal) {
        badgeReveal.set(Math.max(badgeReveal.get(), keyboard));
      }
      if (keyboard >= 1 && (previous?.keyboard ?? 0) < 1) {
        runOnJS(handleKeyboardTookOver)();
      }
    }
  );

  const bloom = useSharedValue(0);
  useEffect(() => {
    if (skipped || !splashFinished || measuringHeading) return;
    const durationMs = durationSeconds * MS_PER_SECOND;
    bloom.set(
      withSequence(
        withTiming(BLOOM_PEAK_OPACITY, {
          duration: durationMs * BLOOM_RISE_SHARE,
          easing: BLOOM_EASING,
        }),
        withTiming(
          0,
          { duration: durationMs * BLOOM_FALL_SHARE, easing: BLOOM_EASING },
          (finished) => {
            if (finished) runOnJS(setBloomDone)(true);
          }
        )
      )
    );
  }, [bloom, durationSeconds, measuringHeading, skipped, splashFinished]);

  const bloomStyle = useAnimatedStyle(() => ({ opacity: bloom.get() }));
  const keyboardFadeStyle = useAnimatedStyle(() => ({
    opacity: keyboardLift
      ? interpolate(keyboardLift.get(), [-KEYBOARD_FADE_DISTANCE, 0], [0, 1])
      : 1,
  }));

  const look = useMemo(() => {
    const geometry = swarmGeometry(screenHeight, headingClearance, logoCenterY);
    return {
      width,
      height: geometry.canvasHeight,
      centerY: geometry.centerInCanvas,
      radius: geometry.radius,
      dotSize: DOT_SIZE,
      drift: DRIFT_DISTANCE * geometry.scale,
      ...(dark ? PALETTE_DARK : PALETTE_LIGHT),
      text:
        heading && outline && headingAnchor
          ? {
              heading,
              left: headingAnchor.left,
              baseline: headingAnchor.baseline - geometry.canvasTop,
              em: headingAnchor.width / outline.advance,
            }
          : null,
    };
  }, [
    dark,
    heading,
    headingAnchor,
    headingClearance,
    logoCenterY,
    outline,
    screenHeight,
    width,
  ]);
  const canvasFrame = useMemo(() => {
    const geometry = swarmGeometry(screenHeight, headingClearance, logoCenterY);
    return { top: geometry.canvasTop, height: geometry.canvasHeight };
  }, [headingClearance, logoCenterY, screenHeight]);
  const handleDotsFinished = useCallback(() => {
    progress.set(1);
    headingReveal?.set(1);
    badgeReveal?.set(withTiming(1, { duration: BADGE_FADE_IN_MS }));
    setDotsDone(true);
  }, [badgeReveal, headingReveal, progress]);

  if (skipped || (dotsDone && bloomDone)) return null;

  return (
    <Animated.View
      style={StyleSheet.absoluteFill}
      exiting={FadeOut.duration(GRADIENT_EXIT_MS)}
      pointerEvents="none"
      testID="new-chat-swarm"
    >
      <Animated.View style={[StyleSheet.absoluteFill, keyboardFadeStyle]}>
        <Animated.View
          style={[
            styles.bloom,
            { height: screenHeight * BLOOM_HEIGHT_FRACTION },
            bloomStyle,
          ]}
        >
          <LinearGradient
            colors={dark ? BLOOM_COLORS_DARK : BLOOM_COLORS_LIGHT}
            locations={BLOOM_LOCATIONS}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        {!dotsDone && !measuringHeading && (
          <Animated.View style={[styles.canvas, canvasFrame]}>
            <ParticleSwarm
              look={look}
              durationSeconds={durationSeconds}
              playing={splashFinished}
              onFinished={handleDotsFinished}
              progress={progress}
            />
          </Animated.View>
        )}
      </Animated.View>
    </Animated.View>
  );
};

export default NewChatSwarm;

const styles = StyleSheet.create({
  bloom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  canvas: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
