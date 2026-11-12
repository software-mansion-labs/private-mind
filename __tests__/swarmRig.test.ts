import type { TgpuRoot } from 'typegpu';
import * as logoPoints from '../components/swarm/logoPoints';
import { prepareSwarm, type SwarmLook } from '../components/swarm/swarmShader';

const FORMAT = 'bgra8unorm' as GPUTextureFormat;

const fakeRoot = () => {
  const created = {
    buffers: 0,
    computePipelines: 0,
    renderPipelines: 0,
    lookWrites: [] as { viewSize: { x: number; y: number } }[],
  };
  const buffer = () => {
    created.buffers += 1;
    const self = {
      $usage: () => self,
      write: (value: (typeof created.lookWrites)[number]) => {
        created.lookWrites.push(value);
      },
    };
    return self;
  };
  const root = {
    device: {},
    createBuffer: buffer,
    createComputePipeline: () => ({ id: (created.computePipelines += 1) }),
    createRenderPipeline: () => ({ id: (created.renderPipelines += 1) }),
    createBindGroup: (_layout: unknown, entries: object) => ({ entries }),
    unwrap: (resource: unknown) => resource,
  };
  return { root: root as unknown as TgpuRoot, created };
};

const look = (changes: Partial<SwarmLook> = {}): SwarmLook => ({
  width: 390,
  height: 570,
  centerY: 285,
  radius: 95,
  dotSize: 1.7,
  drift: 36,
  pixelScale: 3,
  backAlpha: 0.2,
  backColor: [0.66, 0.73, 0.95],
  frontColor: [0.239, 0.38, 0.839],
  highlightColor: [0.118, 0.247, 0.706],
  additive: false,
  text: { heading: 'How can I help?', left: 96, baseline: 330, em: 28 },
  ...changes,
});

describe('swarm GPU resources', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reuses every pipeline and buffer when only the layout or colours change', () => {
    const { root, created } = fakeRoot();
    const first = prepareSwarm(root, look(), FORMAT);
    const afterFirst = { ...created };
    const second = prepareSwarm(
      root,
      look({ width: 430, height: 620, backColor: [0.2, 0.3, 0.68] }),
      FORMAT
    );
    expect(created.buffers).toBe(afterFirst.buffers);
    expect(created.computePipelines).toBe(1);
    expect(created.renderPipelines).toBe(1);
    expect(second.renderPipeline).toBe(first.renderPipeline);
    expect(second.computeGroup).toBe(first.computeGroup);
  });

  it('writes each look into the one uniform buffer', () => {
    const { root, created } = fakeRoot();
    prepareSwarm(root, look(), FORMAT);
    prepareSwarm(root, look({ width: 430 }), FORMAT);
    expect(created.lookWrites.map((written) => written.viewSize.x)).toEqual([
      390, 430,
    ]);
  });

  it('compiles one more render pipeline for the other blend mode and no more', () => {
    const { root, created } = fakeRoot();
    prepareSwarm(root, look(), FORMAT);
    prepareSwarm(root, look({ additive: true }), FORMAT);
    prepareSwarm(root, look({ additive: true, width: 430 }), FORMAT);
    prepareSwarm(root, look(), FORMAT);
    expect(created.renderPipelines).toBe(2);
    expect(created.computePipelines).toBe(1);
  });

  it('samples each heading once', () => {
    const sampleOutline = jest.spyOn(logoPoints, 'sampleOutline');
    const { root, created } = fakeRoot();
    prepareSwarm(root, look(), FORMAT);
    const buffersForOneHeading = created.buffers;
    prepareSwarm(root, look({ width: 430 }), FORMAT);
    expect(sampleOutline).toHaveBeenCalledTimes(1);
    const welcome = { heading: 'Welcome!', left: 120, baseline: 330, em: 28 };
    prepareSwarm(root, look({ text: welcome }), FORMAT);
    prepareSwarm(root, look({ text: welcome, additive: true }), FORMAT);
    expect(sampleOutline).toHaveBeenCalledTimes(2);
    expect(created.buffers).toBe(buffersForOneHeading + 1);
  });
});
