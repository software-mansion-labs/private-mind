import React, { useCallback, useState } from 'react';
import {
  type LayoutChangeEvent,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Blur,
  Canvas,
  Fill,
  Group,
  Paint,
  Shader,
  Skia,
} from '@shopify/react-native-skia';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';
import {
  GLOW_DARK_BOOST,
  GLOW_INTENSITY,
  type GlowFrame,
  type GlowSegment,
  type Rgb,
  glowFrameAt,
  mixRgb,
} from './thinkingGlowMotion';

const BLUR_SIGMA = 14;
const RENDER_SCALE = 4;
const MIN_VISIBLE_ALPHA = 0.002;
const WHITE: Rgb = [255, 255, 255];
const DEEP: Rgb = [20, 40, 140];
const PALE_SHARE = 0.5;
const DEEP_SHARE = 0.25;
const LOWER_BLOBS = 7;
const UPPER_BLOBS = 4;
const UPPER_BLOB_ALPHA = 0.1;
const LOWER_BLOB_ALPHA = 0.9;
const BASE_BLOBS = 5;
const BASE_BLOB_ALPHA = 0.85;
const PULSE_GLOW_DROP = 0.1;
const RISE_STAGGER = 0.6;
const RISE_LAG = 0.55;
const BAND_FILL_FROM = 0.6;
const PULSE_GLOW_WHITEN = 0.15;
const PULSE_GLOW_ALPHA = 0.5;
const BLOB_MID_STOP = 0.45;
const BLOB_MID_SHARE = 0.55;
const BLOB_SLOTS = LOWER_BLOBS + BASE_BLOBS + UPPER_BLOBS;

const CLOUD_EFFECT = Skia.RuntimeEffect.Make(`
uniform float4 blobs[${BLOB_SLOTS}];
uniform float4 tints[${BLOB_SLOTS}];
uniform float4 band;
uniform float4 bandColour;

half4 main(float2 p) {
  float bandAlpha = 0;
  if (p.y > band.x && p.y < band.z) {
    bandAlpha = p.y < band.y
      ? band.w * (p.y - band.x) / (band.y - band.x)
      : band.w * (band.z - p.y) / (band.z - band.y);
  }
  float4 acc = float4(bandColour.rgb * bandAlpha, bandAlpha);
  for (int i = 0; i < ${BLOB_SLOTS}; i++) {
    float4 blob = blobs[i];
    float d = distance(p, blob.xy) / blob.z;
    if (blob.w > 0 && d < 1) {
      float falloff = d < ${BLOB_MID_STOP}
        ? mix(1.0, ${BLOB_MID_SHARE}, d / ${BLOB_MID_STOP})
        : mix(${BLOB_MID_SHARE}, 0.0, (d - ${BLOB_MID_STOP}) / (1.0 - ${BLOB_MID_STOP}));
      float a = blob.w * falloff;
      acc = float4(tints[i].rgb * a, a) + acc * (1 - a);
    }
  }
  return half4(acc);
}
`)!;

type CloudUniforms = {
  blobs: number[];
  tints: number[];
  band: number[];
  bandColour: number[];
};

const unitRgb = (colour: Rgb) => {
  'worklet';
  return [colour[0] / 255, colour[1] / 255, colour[2] / 255, 0];
};

const emptyCloud = (): CloudUniforms => {
  'worklet';
  const blobs: number[] = [];
  const tints: number[] = [];
  for (let slot = 0; slot < BLOB_SLOTS; slot++) {
    blobs.push(0, 0, 1, 0);
    tints.push(0, 0, 0, 0);
  }
  return { blobs, tints, band: [0, 0, 0, 0], bandColour: [0, 0, 0, 0] };
};

const putBlob = (
  cloud: CloudUniforms,
  slot: number,
  x: number,
  y: number,
  radius: number,
  colour: Rgb,
  alpha: number
) => {
  'worklet';
  if (radius <= 0 || alpha <= 0) return;
  const at = slot * 4;
  cloud.blobs[at] = x;
  cloud.blobs[at + 1] = y;
  cloud.blobs[at + 2] = radius;
  cloud.blobs[at + 3] = Math.min(1, alpha);
  cloud.tints[at] = colour[0] / 255;
  cloud.tints[at + 1] = colour[1] / 255;
  cloud.tints[at + 2] = colour[2] / 255;
};

const riseLag = (rise: number, i: number, salt: number, height: number) => {
  'worklet';
  if (rise >= 1) return 0;
  const delay = RISE_STAGGER * (0.5 + 0.5 * Math.sin(i * salt + 1.3));
  const t = Math.max(0, Math.min(1, (rise - delay) / (1 - RISE_STAGGER)));
  return Math.pow(1 - t, 3) * RISE_LAG * height;
};

const cloudOf = (
  frame: GlowFrame,
  width: number,
  height: number,
  seconds: number
): CloudUniforms => {
  'worklet';
  const cloud = emptyCloud();
  const { colour, rise } = frame;
  const bandAlpha =
    0.9 *
    Math.max(0, Math.min(1, (rise - BAND_FILL_FROM) / (1 - BAND_FILL_FROM)));
  const cy = frame.cy * height;
  const thick = frame.thick * height;
  const fadeFrom = Math.max(0, Math.min(1, (cy - thick) / height));
  const peak = Math.min(1, Math.max(fadeFrom + 0.001, cy / height));
  const fadeTo = Math.min(1, Math.max(peak + 0.001, (cy + thick) / height));
  cloud.band = [fadeFrom * height, peak * height, fadeTo * height, bandAlpha];
  cloud.bandColour = unitRgb(colour);

  const pale = mixRgb(colour, WHITE, PALE_SHARE);
  const deep = mixRgb(colour, DEEP, DEEP_SHARE);
  let slot = 0;
  for (let i = 0; i < LOWER_BLOBS; i++) {
    putBlob(
      cloud,
      slot++,
      width * (i / (LOWER_BLOBS - 1)) +
        width * 0.18 * Math.sin(seconds * 0.6 + i * 1.9),
      cy +
        thick * (0.3 + 0.1 * Math.sin(seconds * 0.7 + i * 2.3)) +
        riseLag(rise, i, 2.9, height),
      width * (0.26 + 0.12 * Math.sin(seconds * 0.65 + i)),
      i % 2 ? pale : colour,
      LOWER_BLOB_ALPHA
    );
  }
  for (let i = 0; i < BASE_BLOBS; i++) {
    putBlob(
      cloud,
      slot++,
      width * (i / (BASE_BLOBS - 1)) +
        width * 0.22 * Math.sin(seconds * 0.85 + i * 2.1),
      cy +
        thick * (0.65 + 0.06 * Math.sin(seconds * 0.9 + i * 1.7)) +
        riseLag(rise, i, 4.1, height),
      width * (0.24 + 0.1 * Math.sin(seconds * 0.8 + i * 1.3)),
      i % 2 ? colour : pale,
      BASE_BLOB_ALPHA
    );
  }
  for (let i = 0; i < UPPER_BLOBS; i++) {
    putBlob(
      cloud,
      slot++,
      width * (0.15 + 0.7 * (i / (UPPER_BLOBS - 1))) +
        width * 0.06 * Math.sin(seconds * 0.2 + i * 2.7),
      cy -
        thick * (0.35 + 0.08 * Math.sin(seconds * 0.33 + i)) +
        riseLag(rise, i, 1.7, height),
      width * 0.3,
      i % 2 ? deep : pale,
      UPPER_BLOB_ALPHA
    );
  }
  return cloud;
};

const pulseOf = (
  frame: GlowFrame,
  width: number,
  height: number,
  boost: number
): CloudUniforms => {
  'worklet';
  const cloud = emptyCloud();
  putBlob(
    cloud,
    0,
    width / 2,
    height * (frame.cy + PULSE_GLOW_DROP),
    width * (0.7 + 0.25 * frame.pulse),
    mixRgb(frame.colour, WHITE, PULSE_GLOW_WHITEN),
    PULSE_GLOW_ALPHA * frame.pulse * GLOW_INTENSITY * boost
  );
  return cloud;
};

interface Props {
  segment: SharedValue<GlowSegment>;
  clock: SharedValue<number>;
  pulseStrength: number;
  still: boolean;
  dark: boolean;
}

function ThinkingGlow({ segment, clock, pulseStrength, still, dark }: Props) {
  const window = useWindowDimensions();
  const [area, setArea] = useState({
    width: window.width,
    height: window.height,
  });
  const [origin] = useState(Date.now);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setArea((current) =>
      current.width === width && current.height === height
        ? current
        : { width, height }
    );
  }, []);
  const width = area.width / RENDER_SCALE;
  const height = area.height / RENDER_SCALE;
  const boost = dark ? GLOW_DARK_BOOST : 1;

  const frame = useDerivedValue(() =>
    glowFrameAt(segment.get(), clock.get(), pulseStrength)
  );
  const cloudOpacity = useDerivedValue(() => {
    const alpha = Math.min(1, frame.get().alpha * GLOW_INTENSITY * boost);
    return alpha > MIN_VISIBLE_ALPHA ? alpha : 0;
  });
  const cloud = useDerivedValue(() => {
    const seconds = still ? 0 : (clock.get() - origin) / 1000;
    return cloudOf(frame.get(), width, height, seconds);
  });
  const pulse = useDerivedValue(() =>
    pulseOf(frame.get(), width, height, boost)
  );

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={onLayout}
    >
      <Canvas style={[styles.downscaled, { width, height }]}>
        <Group
          layer={
            <Paint opacity={cloudOpacity}>
              <Blur blur={BLUR_SIGMA / RENDER_SCALE} mode="clamp" />
            </Paint>
          }
        >
          <Fill>
            <Shader source={CLOUD_EFFECT} uniforms={cloud} />
          </Fill>
        </Group>
        <Fill>
          <Shader source={CLOUD_EFFECT} uniforms={pulse} />
        </Fill>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  downscaled: {
    transform: [{ scale: RENDER_SCALE }],
    transformOrigin: 'top left',
  },
});

export default React.memo(ThinkingGlow);
