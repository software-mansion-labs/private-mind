import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import {
  runOnJS,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import { Canvas, installWebGPU, type CanvasRef } from 'react-native-webgpu';
import tgpu, { type TgpuRoot } from 'typegpu';
import {
  buildSwarm,
  SWARM_DOT_COUNT,
  SWARM_QUAD_VERTICES,
  SWARM_WORKGROUPS,
  type SwarmLook,
} from './swarmShader';

const MS_PER_SECOND = 1000;
const ANGLE_SPEED = 0.5;
const DESIGNED_DURATION_SECONDS = 2;
const MIN_FRAME_INTERVAL_MS = 10;

let sharedRoot: Promise<TgpuRoot> | null = null;
const getRoot = () => {
  sharedRoot ??= tgpu.init().catch((error) => {
    sharedRoot = null;
    throw error;
  });
  return sharedRoot;
};

const builtSwarms = new Map<string, ReturnType<typeof buildSwarm>>();

const getSwarm = (
  root: TgpuRoot,
  look: SwarmLook,
  format: GPUTextureFormat
) => {
  const key = `${format}:${JSON.stringify(look)}`;
  const cached = builtSwarms.get(key);
  if (cached) return cached;
  const swarm = buildSwarm(root, look, format);
  builtSwarms.set(key, swarm);
  return swarm;
};

type Built = ReturnType<typeof buildSwarm> & {
  context: NonNullable<ReturnType<CanvasRef['getContext']>>;
  format: GPUTextureFormat;
};

interface Props {
  look: Omit<SwarmLook, 'pixelScale'>;
  durationSeconds: number;
  playing: boolean;
  onFinished: () => void;
}

const ParticleSwarm = ({
  look,
  durationSeconds,
  playing,
  onFinished,
}: Props) => {
  const canvasRef = useRef<CanvasRef>(null);
  const [built, setBuilt] = useState<Built | null>(null);
  const [startAngle] = useState(() => Math.random() * 6);
  const [finished, setFinished] = useState(false);

  const finishRef = useRef(onFinished);
  useEffect(() => {
    finishRef.current = onFinished;
  }, [onFinished]);

  const alreadyFinished = useRef(false);
  const finish = useCallback(() => {
    if (alreadyFinished.current) return;
    alreadyFinished.current = true;
    setFinished(true);
    finishRef.current();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const root = await getRoot();
        if (cancelled) return;
        const canvas = canvasRef.current;
        const context = canvas?.getContext('webgpu');
        const surface = canvas?.getNativeSurface();
        if (!context || !surface) {
          finish();
          return;
        }
        const format = navigator.gpu.getPreferredCanvasFormat();
        const swarm = getSwarm(
          root,
          { ...look, pixelScale: surface.width / surface.clientWidth },
          format
        );
        setBuilt({ ...swarm, context, format });
      } catch (error) {
        console.error('Particle swarm could not start', error);
        if (!cancelled) finish();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [finish, look]);

  const startedAt = useSharedValue<number | null>(null);
  const lastDrawnAt = useSharedValue(0);

  const frameCallback = useFrameCallback((frame) => {
    'worklet';
    if (!built) return;
    let start = startedAt.get();
    if (start === null) {
      installWebGPU();
      built.context.configure({
        device: built.device,
        format: built.format,
        alphaMode: 'premultiplied',
      });
      start = frame.timestamp;
      startedAt.set(start);
    } else if (frame.timestamp - lastDrawnAt.get() < MIN_FRAME_INTERVAL_MS) {
      return;
    }
    lastDrawnAt.set(frame.timestamp);

    const elapsed = (frame.timestamp - start) / MS_PER_SECOND;
    const progress = elapsed / durationSeconds;
    const motionTime = progress * DESIGNED_DURATION_SECONDS;
    if (progress >= 1) {
      runOnJS(finish)();
      return;
    }

    built.device.queue.writeBuffer(
      built.clockBuffer,
      0,
      new Float32Array([
        motionTime,
        progress,
        startAngle + motionTime * ANGLE_SPEED,
      ])
    );
    const encoder = built.device.createCommandEncoder();
    const compute = encoder.beginComputePass();
    compute.setPipeline(built.computePipeline);
    compute.setBindGroup(0, built.computeGroup);
    compute.dispatchWorkgroups(SWARM_WORKGROUPS);
    compute.end();
    const render = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: built.context.getCurrentTexture().createView(),
          clearValue: [0, 0, 0, 0],
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    render.setPipeline(built.renderPipeline);
    render.setBindGroup(0, built.renderGroup);
    render.draw(SWARM_QUAD_VERTICES, SWARM_DOT_COUNT);
    render.end();
    built.device.queue.submit([encoder.finish()]);
    built.context.present();
  }, false);

  const { setActive } = frameCallback;
  useEffect(() => {
    setActive(built !== null && playing && !finished);
    return () => setActive(false);
  }, [built, finished, playing, setActive]);

  return <Canvas ref={canvasRef} style={StyleSheet.absoluteFill} />;
};

export default memo(ParticleSwarm);
