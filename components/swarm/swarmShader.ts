import tgpu, { d, std, type TgpuRoot } from 'typegpu';

export const SWARM_DOT_COUNT = 5000;
const WORKGROUP_SIZE = 64;
export const SWARM_WORKGROUPS = Math.ceil(SWARM_DOT_COUNT / WORKGROUP_SIZE);
const VERTICES_PER_QUAD = 4;
export const SWARM_QUAD_VERTICES = VERTICES_PER_QUAD;

const Source = d.struct({
  home: d.vec3f,
  arrivalJitter: d.f32,
  departureJitter: d.f32,
});

const Dot = d.struct({
  position: d.vec2f,
  pixelSize: d.f32,
  alpha: d.f32,
  color: d.vec3f,
});

const Clock = d.struct({
  time: d.f32,
  progress: d.f32,
  angle: d.f32,
});

const Look = d.struct({
  viewSize: d.vec2f,
  center: d.vec2f,
  radius: d.f32,
  dotSize: d.f32,
  rise: d.f32,
  drift: d.f32,
  pixelScale: d.f32,
  backAlpha: d.f32,
  backColor: d.vec3f,
  frontColor: d.vec3f,
  highlightColor: d.vec3f,
});

const computeLayout = tgpu.bindGroupLayout({
  sources: { storage: d.arrayOf(Source) },
  dots: { storage: d.arrayOf(Dot), access: 'mutable' },
  clock: { uniform: Clock },
  look: { uniform: Look },
});

const renderLayout = tgpu.bindGroupLayout({
  dots: { storage: d.arrayOf(Dot) },
  look: { uniform: Look },
});

const mod289v3 = (x: d.v3f): d.v3f => {
  'use gpu';
  return x.sub(std.floor(x.mul(1 / 289)).mul(289));
};

const mod289v4 = (x: d.v4f): d.v4f => {
  'use gpu';
  return x.sub(std.floor(x.mul(1 / 289)).mul(289));
};

const permute = (x: d.v4f): d.v4f => {
  'use gpu';
  return mod289v4(x.mul(34).add(1).mul(x));
};

const simplexNoise = (v: d.v3f): number => {
  'use gpu';
  const cellOrigin = std.floor(v.add(std.dot(v, d.vec3f(1 / 3))));
  const x0 = v.sub(cellOrigin).add(std.dot(cellOrigin, d.vec3f(1 / 6)));
  const g = std.step(x0.yzx, x0.xyz);
  const l = d.vec3f(1).sub(g);
  const i1 = std.min(g.xyz, l.zxy);
  const i2 = std.max(g.xyz, l.zxy);
  const x1 = x0.sub(i1).add(1 / 6);
  const x2 = x0.sub(i2).add(1 / 3);
  const x3 = x0.sub(0.5);
  const i = mod289v3(cellOrigin);
  const p = permute(
    permute(
      permute(d.vec4f(0, i1.z, i2.z, 1).add(i.z))
        .add(i.y)
        .add(d.vec4f(0, i1.y, i2.y, 1))
    )
      .add(i.x)
      .add(d.vec4f(0, i1.x, i2.x, 1))
  );
  const n = 0.142857142857;
  const ns = d.vec3f(2 * n, 0.5 * n - 1, n);
  const j = p.sub(std.floor(p.mul(ns.z * ns.z)).mul(49));
  const xFloor = std.floor(j.mul(ns.z));
  const yFloor = std.floor(j.sub(xFloor.mul(7)));
  const x = xFloor.mul(ns.x).add(ns.y);
  const y = yFloor.mul(ns.x).add(ns.y);
  const h = d.vec4f(1).sub(std.abs(x)).sub(std.abs(y));
  const b0 = d.vec4f(x.x, x.y, y.x, y.y);
  const b1 = d.vec4f(x.z, x.w, y.z, y.w);
  const s0 = std.floor(b0).mul(2).add(1);
  const s1 = std.floor(b1).mul(2).add(1);
  const sh = std.neg(std.step(h, d.vec4f(0)));
  const a0 = b0.xzyw.add(s0.xzyw.mul(sh.xxyy));
  const a1 = b1.xzyw.add(s1.xzyw.mul(sh.zzww));
  const p0 = d.vec3f(a0.x, a0.y, h.x);
  const p1 = d.vec3f(a0.z, a0.w, h.y);
  const p2 = d.vec3f(a1.x, a1.y, h.z);
  const p3 = d.vec3f(a1.z, a1.w, h.w);
  const norm = d
    .vec4f(1.79284291400159)
    .sub(
      d
        .vec4f(
          std.dot(p0, p0),
          std.dot(p1, p1),
          std.dot(p2, p2),
          std.dot(p3, p3)
        )
        .mul(0.85373472095314)
    );
  const m = std.max(
    d
      .vec4f(0.6)
      .sub(
        d.vec4f(
          std.dot(x0, x0),
          std.dot(x1, x1),
          std.dot(x2, x2),
          std.dot(x3, x3)
        )
      ),
    d.vec4f(0)
  );
  const m2 = m.mul(m);
  return (
    42 *
    std.dot(
      m2.mul(m2),
      d.vec4f(
        std.dot(p0.mul(norm.x), x0),
        std.dot(p1.mul(norm.y), x1),
        std.dot(p2.mul(norm.z), x2),
        std.dot(p3.mul(norm.w), x3)
      )
    )
  );
};

const rotateY = (p: d.v3f, a: number): d.v3f => {
  'use gpu';
  const c = std.cos(a);
  const s = std.sin(a);
  return d.vec3f(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
};

const rotateX = (p: d.v3f, a: number): d.v3f => {
  'use gpu';
  const c = std.cos(a);
  const s = std.sin(a);
  return d.vec3f(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
};

const easeOutCubic = (x: number): number => {
  'use gpu';
  const inverse = 1 - std.clamp(x, 0, 1);
  return 1 - inverse * inverse * inverse;
};

const updateDots = tgpu.computeFn({
  in: { id: d.builtin.globalInvocationId },
  workgroupSize: [WORKGROUP_SIZE],
})(({ id }) => {
  'use gpu';
  if (id.x >= SWARM_DOT_COUNT) {
    return;
  }
  const source = computeLayout.$.sources[id.x];
  const clock = computeLayout.$.clock;
  const look = computeLayout.$.look;
  const home = source.home;
  const t = clock.time;

  const arrival = easeOutCubic(
    (clock.progress - source.arrivalJitter * 0.15) / 0.46
  );
  const departure = std.clamp(
    (clock.progress - 0.5 - source.departureJitter * 0.18) / 0.32,
    0,
    1
  );
  const departureSquared = departure * departure;
  const coarse = simplexNoise(
    home.mul(1.35).add(d.vec3f(t * 0.3, -t * 0.2, t * 0.25))
  );
  const fine = simplexNoise(home.mul(3).add(d.vec3f(-t * 0.25, t * 0.35, 0)));
  const swell =
    (1 + coarse * 0.17 + fine * 0.04) * (0.25 + 0.75 * arrival) +
    departureSquared * 1.1;
  const p = rotateX(
    rotateY(
      home.mul(swell),
      clock.angle * (0.7 + 0.6 * source.departureJitter)
    ),
    0.2
  );

  const perspective = 1 / (1 - p.z * 0.22);
  const depth = std.clamp((p.z + 1) * 0.5, 0, 1);
  const size =
    look.dotSize *
    std.mix(0.55, 1.15, depth) *
    perspective *
    (1 - departure * 0.5) *
    look.pixelScale;
  const alpha =
    std.mix(look.backAlpha, 1, std.pow(depth, 1.3)) *
    arrival *
    (1 - departureSquared);
  const highlight = 0.5 + 0.5 * coarse;
  const body = std.mix(look.backColor, look.frontColor, depth);

  computeLayout.$.dots[id.x] = Dot({
    position: look.center
      .add(d.vec2f(p.x, -p.y).mul(look.radius * perspective))
      .add(
        d.vec2f(0, (1 - arrival) * look.rise - departureSquared * look.drift)
      ),
    pixelSize: std.max(size, 1),
    alpha: alpha * std.min(size, 1),
    color: std.mix(body, look.highlightColor, highlight * depth),
  });
});

const QUAD_EDGE_FEATHER_PX = 1.5;

export interface SwarmLook {
  width: number;
  height: number;
  centerY: number;
  radius: number;
  dotSize: number;
  rise: number;
  drift: number;
  pixelScale: number;
  backAlpha: number;
  backColor: readonly [number, number, number];
  frontColor: readonly [number, number, number];
  highlightColor: readonly [number, number, number];
  additive: boolean;
}

const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const SOURCE_SEED = 7;

const fibonacciSources = () => {
  const random = mulberry32(SOURCE_SEED);
  return Array.from({ length: SWARM_DOT_COUNT }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / SWARM_DOT_COUNT;
    const ring = Math.sqrt(1 - y * y);
    const theta = i * GOLDEN_ANGLE;
    return {
      home: d.vec3f(Math.cos(theta) * ring, y, Math.sin(theta) * ring),
      arrivalJitter: random(),
      departureJitter: random(),
    };
  });
};

export const SWARM_CLOCK_BYTES = 12;

export const buildSwarm = (
  root: TgpuRoot,
  look: SwarmLook,
  format: GPUTextureFormat
) => {
  const sources = root
    .createBuffer(d.arrayOf(Source, SWARM_DOT_COUNT), fibonacciSources())
    .$usage('storage');
  const dots = root
    .createBuffer(d.arrayOf(Dot, SWARM_DOT_COUNT))
    .$usage('storage');
  const clock = root.createBuffer(Clock).$usage('uniform');
  const lookBuffer = root
    .createBuffer(Look, {
      viewSize: d.vec2f(look.width, look.height),
      center: d.vec2f(look.width / 2, look.centerY),
      radius: look.radius,
      dotSize: look.dotSize,
      rise: look.rise,
      drift: look.drift,
      pixelScale: look.pixelScale,
      backAlpha: look.backAlpha,
      backColor: d.vec3f(...look.backColor),
      frontColor: d.vec3f(...look.frontColor),
      highlightColor: d.vec3f(...look.highlightColor),
    })
    .$usage('uniform');

  const computePipeline = root.createComputePipeline({ compute: updateDots });

  const renderPipeline = root.createRenderPipeline({
    vertex: ({ $vertexIndex, $instanceIndex }) => {
      'use gpu';
      const dot = renderLayout.$.dots[$instanceIndex];
      const size = renderLayout.$.look.viewSize;
      const scale = renderLayout.$.look.pixelScale;
      const corner = d.vec2f(
        d.f32($vertexIndex & 1) * 2 - 1,
        d.f32($vertexIndex >>> 1) * 2 - 1
      );
      const extent = (dot.pixelSize + QUAD_EDGE_FEATHER_PX) * 0.5;
      const local = corner.mul(extent);
      const pixel = dot.position.mul(scale).add(local);
      const ndc = pixel.div(size.mul(scale)).mul(2).sub(1);
      return {
        $position: d.vec4f(ndc.x, -ndc.y, 0, 1),
        local,
        dotRadius: dot.pixelSize * 0.5,
        alpha: dot.alpha,
        color: dot.color,
      };
    },
    fragment: ({ local, dotRadius, alpha, color }) => {
      'use gpu';
      const coverage =
        std.clamp(dotRadius - std.length(local) + 0.5, 0, 1) * alpha;
      return d.vec4f(color.mul(coverage), coverage);
    },
    targets: {
      format,
      blend: {
        color: {
          srcFactor: 'one',
          dstFactor: look.additive ? 'one' : 'one-minus-src-alpha',
          operation: 'add',
        },
        alpha: {
          srcFactor: 'one',
          dstFactor: look.additive ? 'one' : 'one-minus-src-alpha',
          operation: 'add',
        },
      },
    },
    primitive: { topology: 'triangle-strip' },
  });

  const computeGroup = root.createBindGroup(computeLayout, {
    sources,
    dots,
    clock,
    look: lookBuffer,
  });
  const renderGroup = root.createBindGroup(renderLayout, {
    dots,
    look: lookBuffer,
  });

  return {
    device: root.device,
    computePipeline: root.unwrap(computePipeline),
    renderPipeline: root.unwrap(renderPipeline),
    computeGroup: root.unwrap(computeGroup),
    renderGroup: root.unwrap(renderGroup),
    clockBuffer: root.unwrap(clock),
  };
};
