import tgpu, { d, std, type TgpuRoot } from 'typegpu';
import { sampleLogo, sampleOutline, seededRandom } from './logoPoints';
import { HEADING_OUTLINES, HEADING_UNITS_PER_EM } from './headingOutlines';

export const SWARM_DOT_COUNT = 3000;
const WORKGROUP_SIZE = 64;
export const SWARM_WORKGROUPS = Math.ceil(SWARM_DOT_COUNT / WORKGROUP_SIZE);
const VERTICES_PER_QUAD = 4;
export const SWARM_QUAD_VERTICES = VERTICES_PER_QUAD;

const Source = d.struct({
  home: d.vec3f,
  arrivalJitter: d.f32,
  departureJitter: d.f32,
  origin: d.vec3f,
  morphJitter: d.f32,
  glyph: d.vec2f,
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
  drift: d.f32,
  pixelScale: d.f32,
  backAlpha: d.f32,
  backColor: d.vec3f,
  frontColor: d.vec3f,
  highlightColor: d.vec3f,
  textOrigin: d.vec2f,
  textEm: d.f32,
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

const SWIRL = 0.2;
const HALF_TURN = Math.PI;

const easeOutCubic = (x: number): number => {
  'use gpu';
  const inverse = 1 - std.clamp(x, 0, 1);
  return 1 - inverse * inverse * inverse;
};

const easeInOutCubic = (x: number): number => {
  'use gpu';
  const t = std.clamp(x, 0, 1);
  const rising = 4 * t * t * t;
  const back = -2 * t + 2;
  return std.select(1 - (back * back * back) / 2, rising, t < 0.5);
};

const TEXT_ARRIVAL_SPAN = 0.32;
const TEXT_ARRIVAL_SPREAD = 0.1;
const MORPH_START = 0.46;
const MORPH_SPREAD = 0.14;
const MORPH_SPAN = 0.26;
const HANDOFF_START = 0.86;
const HANDOFF_SPAN = 0.1;
const MORPH_ARC = 0.22;
const TEXT_DOT_SCALE = 0.85;

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

  const textMode = std.select(d.f32(0), d.f32(1), look.textEm > 0);
  const arrival = easeOutCubic(
    (clock.progress -
      source.arrivalJitter * std.mix(0.15, TEXT_ARRIVAL_SPREAD, textMode)) /
      std.mix(0.46, TEXT_ARRIVAL_SPAN, textMode)
  );
  const departure =
    std.clamp(
      (clock.progress - 0.5 - source.departureJitter * 0.18) / 0.32,
      0,
      1
    ) *
    (1 - textMode);
  const morph =
    easeInOutCubic(
      (clock.progress - MORPH_START - source.morphJitter * MORPH_SPREAD) /
        MORPH_SPAN
    ) * textMode;
  const handoff =
    std.clamp((clock.progress - HANDOFF_START) / HANDOFF_SPAN, 0, 1) * textMode;
  const departureSquared = departure * departure;
  const coarse = simplexNoise(
    home.mul(2.2).add(d.vec3f(t * 0.3, -t * 0.2, t * 0.25))
  );
  const fine = simplexNoise(home.mul(5).add(d.vec3f(-t * 0.25, t * 0.35, 0)));
  const shimmer = d.vec3f(coarse, fine, coarse * fine).mul(0.018 * (1 - morph));
  const scatter = d.vec3f(coarse, fine, 0).mul(departureSquared * 0.45);
  const flight = home.sub(source.origin);
  const swirl = d
    .vec3f(-flight.y, flight.x, 0)
    .mul(std.sin(arrival * HALF_TURN) * SWIRL);
  const travelled = std.mix(source.origin, home, arrival).add(swirl);
  const spread = travelled
    .mul(1 + departureSquared * 0.35)
    .add(shimmer)
    .add(scatter);
  const p = rotateX(rotateY(spread, std.sin(clock.angle) * 0.18), 0.08);

  const perspective = 1 / (1 - p.z * 0.22);
  const depth = std.clamp(0.75 + p.z * 0.6, 0, 1);
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
  const highlight = 0.25 + 0.35 * (0.5 + 0.5 * coarse);
  const body = std.mix(look.backColor, look.frontColor, depth);

  const inLogo = look.center
    .add(d.vec2f(p.x, -p.y).mul(look.radius * perspective))
    .add(d.vec2f(0, -departureSquared * look.drift));
  const inText = look.textOrigin.add(source.glyph.mul(look.textEm));
  const path = inText.sub(inLogo);
  const arc = d
    .vec2f(-path.y, path.x)
    .mul(std.sin(morph * HALF_TURN) * MORPH_ARC * (source.morphJitter - 0.5));
  const textSize = look.dotSize * TEXT_DOT_SCALE * look.pixelScale;
  const finalSize = std.mix(size, textSize, morph);

  computeLayout.$.dots[id.x] = Dot({
    position: std.mix(inLogo, inText, morph).add(arc),
    pixelSize: std.max(finalSize, 1),
    alpha:
      std.mix(alpha * std.min(size, 1), std.min(textSize, 1), morph) *
      (1 - handoff),
    color: std.mix(
      std.mix(body, look.highlightColor, highlight),
      look.highlightColor,
      morph
    ),
  });
});

const QUAD_EDGE_FEATHER_PX = 1.5;

export interface SwarmLook {
  width: number;
  height: number;
  centerY: number;
  radius: number;
  dotSize: number;
  drift: number;
  pixelScale: number;
  backAlpha: number;
  backColor: readonly [number, number, number];
  frontColor: readonly [number, number, number];
  highlightColor: readonly [number, number, number];
  additive: boolean;
  text: SwarmText | null;
}

export interface SwarmText {
  heading: string;
  left: number;
  baseline: number;
  em: number;
}

const SOURCE_SEED = 7;
const LOGO_DEPTH = 0.12;
const ORIGIN_NEAREST = 1.3;
const ORIGIN_SPREAD = 1.1;
const ORIGIN_VERTICAL_STRETCH = 1.15;
const ORIGIN_DEPTH = 0.6;

const byX = (points: readonly (readonly [number, number])[]) =>
  points
    .map((point, index) => ({ x: point[0], index }))
    .sort((a, b) => a.x - b.x)
    .map(({ index }) => index);

const glyphsFor = (
  logo: readonly (readonly [number, number])[],
  heading: string | null
) => {
  const outline = heading ? HEADING_OUTLINES[heading] : undefined;
  if (!outline) return logo.map(() => d.vec2f(0, 0));
  const text = sampleOutline(
    outline.path,
    logo.length,
    SOURCE_SEED,
    HEADING_UNITS_PER_EM
  );
  const logoOrder = byX(logo);
  const textOrder = byX(text);
  const glyphs = new Array<ReturnType<typeof d.vec2f>>(logo.length);
  logoOrder.forEach((logoIndex, rank) => {
    const [x, y] = text[textOrder[rank]];
    glyphs[logoIndex] = d.vec2f(x, y);
  });
  return glyphs;
};

const logoSources = (heading: string | null) => {
  const random = seededRandom(SOURCE_SEED);
  const logo = sampleLogo(SWARM_DOT_COUNT, SOURCE_SEED);
  const glyphs = glyphsFor(logo, heading);
  return logo.map(([x, y], index) => {
    const angle = random() * 2 * Math.PI;
    const distance = ORIGIN_NEAREST + random() * ORIGIN_SPREAD;
    return {
      morphJitter: random(),
      glyph: glyphs[index],
      home: d.vec3f(x, y, (random() * 2 - 1) * LOGO_DEPTH),
      arrivalJitter: random(),
      departureJitter: random(),
      origin: d.vec3f(
        Math.cos(angle) * distance,
        Math.sin(angle) * distance * ORIGIN_VERTICAL_STRETCH,
        (random() * 2 - 1) * ORIGIN_DEPTH
      ),
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
    .createBuffer(
      d.arrayOf(Source, SWARM_DOT_COUNT),
      logoSources(look.text?.heading ?? null)
    )
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
      drift: look.drift,
      pixelScale: look.pixelScale,
      backAlpha: look.backAlpha,
      backColor: d.vec3f(...look.backColor),
      frontColor: d.vec3f(...look.frontColor),
      highlightColor: d.vec3f(...look.highlightColor),
      textOrigin: d.vec2f(look.text?.left ?? 0, look.text?.baseline ?? 0),
      textEm:
        look.text && HEADING_OUTLINES[look.text.heading] ? look.text.em : 0,
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
