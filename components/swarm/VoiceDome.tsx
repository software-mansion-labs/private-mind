import React, {
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { Canvas, installWebGPU, type CanvasRef } from 'react-native-webgpu';
import { getGpuRoot } from './gpuRoot';
import { prepareVoiceDome, VOICE_DOME_FRAME_FLOATS } from './voiceDomeShader';
import {
  SILENT_VOICE,
  voiceLevels,
  withSpeechSway,
  type VoiceLevels,
} from '../../utils/voiceLevels';

export type VoiceDomePhase =
  'waiting' | 'loading' | 'listening' | 'processing' | 'leaving';

export interface VoiceDomeHandle {
  pushChunk: (samples: number[]) => void;
}

interface Props {
  ref?: React.Ref<VoiceDomeHandle>;
  phase: VoiceDomePhase;
  sampleRate: number;
  chunkSeconds: number;
  cornerRadius: number;
  maxHeight: number;
  palette: readonly (readonly [number, number, number])[];
}

const MS_PER_SECOND = 1000;
const MIN_FRAME_INTERVAL_MS = 10;
const LONGEST_FRAME_SECONDS = 0.05;
const SLICES_PER_CHUNK = 3;
const ATTACK_SECONDS = 0.05;
const RELEASE_SECONDS = 0.2;
const LEAVE_SECONDS = 0.5;
const BEAM_EASE_SECONDS = 0.2;
const BEAM_RESTS_BELOW = 0.001;
const SETTLED_ENTER_SECONDS = 10;
const frameValues = new Float32Array(VOICE_DOME_FRAME_FLOATS);

type Built = ReturnType<typeof prepareVoiceDome> & {
  context: NonNullable<ReturnType<CanvasRef['getContext']>>;
  format: GPUTextureFormat;
  pixelScale: number;
};

const VoiceDome = ({
  ref,
  phase,
  sampleRate,
  chunkSeconds,
  cornerRadius,
  maxHeight,
  palette,
}: Props) => {
  const canvasRef = useRef<CanvasRef>(null);
  const [built, setBuilt] = useState<Built | null>(null);
  const firstPalette = useRef(palette);

  const size = useSharedValue({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    size.set({ width, height });
  };

  const chunk = useSharedValue<{ id: number; slices: VoiceLevels[] }>({
    id: 0,
    slices: [],
  });
  useImperativeHandle(
    ref,
    () => ({
      pushChunk: (samples) => {
        chunk.set({
          id: chunk.get().id + 1,
          slices: voiceLevels(samples, sampleRate, SLICES_PER_CHUNK),
        });
      },
    }),
    [chunk, sampleRate]
  );

  const phaseNow = useSharedValue<VoiceDomePhase>(phase);
  useEffect(() => {
    phaseNow.set(phase);
  }, [phase, phaseNow]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const root = await getGpuRoot();
        if (cancelled) return;
        const canvas = canvasRef.current;
        const context = canvas?.getContext('webgpu');
        const surface = canvas?.getNativeSurface();
        if (!context || !surface) return;
        const format = navigator.gpu.getPreferredCanvasFormat();
        setBuilt({
          ...prepareVoiceDome(root, format, firstPalette.current),
          context,
          format,
          pixelScale: surface.width / surface.clientWidth,
        });
      } catch (error) {
        console.error('Voice dome could not start', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    built?.writePalette(palette);
  }, [built, palette]);

  const lastDrawnAt = useSharedValue<number | null>(null);
  const clock = useSharedValue(0);
  const seenPhase = useSharedValue<VoiceDomePhase | null>(null);
  const phaseStartedAt = useSharedValue(0);
  const heardVoice = useSharedValue(false);
  const beam = useSharedValue(0);
  const beamClock = useSharedValue(0);
  const seenChunk = useSharedValue(0);
  const chunkArrivedAt = useSharedValue(0);
  const levels = useSharedValue<VoiceLevels>(SILENT_VOICE);

  const frameCallback = useFrameCallback((frame) => {
    'worklet';
    if (!built) return;
    const { width, height } = size.get();
    if (width === 0 || height === 0) return;
    const now = frame.timestamp;
    const previous = lastDrawnAt.get();
    if (previous === null) {
      installWebGPU();
      built.context.configure({
        device: built.device,
        format: built.format,
        alphaMode: 'premultiplied',
      });
    } else if (now - previous < MIN_FRAME_INTERVAL_MS) {
      return;
    }
    lastDrawnAt.set(now);
    const dt =
      previous === null
        ? 0
        : Math.min(LONGEST_FRAME_SECONDS, (now - previous) / MS_PER_SECOND);
    clock.set(clock.get() + dt);

    const current = phaseNow.get();
    if (current !== seenPhase.get()) {
      seenPhase.set(current);
      phaseStartedAt.set(now);
      if (current === 'listening') heardVoice.set(true);
    }
    const inPhase = (now - phaseStartedAt.get()) / MS_PER_SECOND;

    const incoming = chunk.get();
    if (incoming.id !== seenChunk.get()) {
      seenChunk.set(incoming.id);
      chunkArrivedAt.set(now);
    }
    const sliceSeconds = chunkSeconds / SLICES_PER_CHUNK;
    const slice = Math.min(
      incoming.slices.length - 1,
      Math.floor((now - chunkArrivedAt.get()) / MS_PER_SECOND / sliceSeconds)
    );
    const target =
      current === 'listening' && slice >= 0
        ? incoming.slices[slice]
        : SILENT_VOICE;
    const was = levels.get();
    const follow = (from: number, to: number) => {
      const tau = to > from ? ATTACK_SECONDS : RELEASE_SECONDS;
      return from + (to - from) * (1 - Math.exp(-dt / tau));
    };
    const next = {
      level: follow(was.level, target.level),
      low: follow(was.low, target.low),
      mid: follow(was.mid, target.mid),
      high: follow(was.high, target.high),
    };
    levels.set(next);
    const shown = withSpeechSway(next, clock.get());

    const enterTime =
      current === 'listening'
        ? inPhase
        : heardVoice.get() && current !== 'waiting'
          ? SETTLED_ENTER_SECONDS
          : 0;
    const beamTarget =
      current === 'loading' || current === 'processing' ? 1 : 0;
    const beamNow =
      beamTarget === 0
        ? 0
        : beam.get() +
          (beamTarget - beam.get()) * (1 - Math.exp(-dt / BEAM_EASE_SECONDS));
    beam.set(beamNow);
    beamClock.set(beamNow < BEAM_RESTS_BELOW ? 0 : beamClock.get() + dt);
    const leave =
      current === 'leaving' ? Math.min(1, inPhase / LEAVE_SECONDS) : 0;

    frameValues[0] = width;
    frameValues[1] = height;
    frameValues[2] = clock.get();
    frameValues[3] = built.pixelScale;
    frameValues[4] = shown.level;
    frameValues[5] = shown.low;
    frameValues[6] = shown.mid;
    frameValues[7] = shown.high;
    frameValues[8] = enterTime;
    frameValues[9] = leave;
    frameValues[10] = beamClock.get();
    frameValues[11] = beamNow * beamNow * (3 - 2 * beamNow);
    frameValues[12] = cornerRadius;
    frameValues[13] = maxHeight;
    built.device.queue.writeBuffer(built.frameBuffer, 0, frameValues);

    const encoder = built.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: built.context.getCurrentTexture().createView(),
          clearValue: [0, 0, 0, 0],
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.setPipeline(built.pipeline);
    pass.setBindGroup(0, built.group);
    pass.draw(3);
    pass.end();
    built.device.queue.submit([encoder.finish()]);
    built.context.present();
  }, false);

  const { setActive } = frameCallback;
  useEffect(() => {
    setActive(built !== null && phase !== 'waiting');
    return () => setActive(false);
  }, [built, phase, setActive]);

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={onLayout}
    >
      <Canvas ref={canvasRef} style={StyleSheet.absoluteFill} />
    </View>
  );
};

export default memo(VoiceDome);
