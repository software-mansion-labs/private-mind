import tgpu, { d, std, type TgpuRoot } from 'typegpu';

const Frame = d.struct({
  size: d.vec2f,
  time: d.f32,
  pixelScale: d.f32,
  level: d.f32,
  low: d.f32,
  mid: d.f32,
  high: d.f32,
  enterTime: d.f32,
  leave: d.f32,
  processTime: d.f32,
  gather: d.f32,
  radius: d.f32,
  maxHeight: d.f32,
});

export const VOICE_DOME_FRAME_FLOATS = 14;

const PALETTE_SIZE = 5;
const Palette = d.arrayOf(d.vec4f, PALETTE_SIZE);

type Rgb = readonly [number, number, number];

export const VOICE_DOME_PALETTE: readonly Rgb[] = [
  [111, 231, 255],
  [180, 140, 255],
  [255, 127, 207],
  [255, 169, 138],
  [233, 228, 255],
];

export const VOICE_DOME_PALETTE_CANCELLED: readonly Rgb[] = [
  [229, 72, 77],
  [240, 114, 122],
  [217, 58, 106],
  [242, 135, 95],
  [201, 58, 67],
];

export const VOICE_DOME_PALETTE_ON_LIGHT: readonly Rgb[] = [
  [61, 97, 214],
  [139, 92, 246],
  [224, 85, 155],
  [31, 159, 214],
  [238, 126, 82],
];

const layout = tgpu.bindGroupLayout({
  frame: { uniform: Frame },
  palette: { uniform: Palette },
});

const PITCH = 3.2;
const PIXEL = 2.1;
const ENTER_SECONDS = 0.8;
const BEAM_SPEED = 2.2;
const HALO = 0.14;
const HUE_DRIFT = 0.035;
const HUE_SPAN = 0.55;
const HUE_RISE = 0.3;
const CORE_WHITENING = 0.12;
const MIN_REACH = 0.5;
const QUARTER_TURN = Math.PI / 2;

const bayer2 = (a: number, b: number): number => {
  'use gpu';
  return 2 * std.abs(a - b) + b;
};

const bayer4 = (c: number, r: number): number => {
  'use gpu';
  const x = c - std.floor(c / 4) * 4;
  const y = r - std.floor(r / 4) * 4;
  const x0 = x - std.floor(x / 2) * 2;
  const y0 = y - std.floor(y / 2) * 2;
  return (
    (4 * bayer2(x0, y0) + bayer2(std.floor(x / 2), std.floor(y / 2)) + 0.5) / 16
  );
};

const samplePalette = (k: number): d.v3f => {
  'use gpu';
  const f = std.fract(k) * PALETTE_SIZE;
  const i = std.floor(f);
  const next = i + 1 - std.floor((i + 1) / PALETTE_SIZE) * PALETTE_SIZE;
  const a = layout.$.palette[d.i32(i)].xyz;
  const b = layout.$.palette[d.i32(next)].xyz;
  return std.mix(a, b, f - i);
};

const lobe = (x: number, center: number, width: number, energy: number) => {
  'use gpu';
  const k = (x - center) / width;
  return energy * 0.9 * std.exp(-k * k);
};

const beamAt = (s: number, beam: number): number => {
  'use gpu';
  const k = (s - beam) / 30;
  return 0.75 * std.exp(-k * k);
};

const withinCorner = (s: number, bottomRun: number, arc: number) => {
  'use gpu';
  return 1 - std.smoothstep(bottomRun + arc * 0.7, bottomRun + arc, std.abs(s));
};

const lobeCenter = (base: number, index: number, time: number): number => {
  'use gpu';
  return base + 0.035 * std.sin(time * 0.5 + index * 1.9);
};

const heightAt = (s: number, beam: number, amp: number): number => {
  'use gpu';
  const f = layout.$.frame;
  const w = f.size.x;
  const half = w / 2;
  const bottomRun = half - f.radius;
  const arc = QUARTER_TURN * f.radius;
  const x = s / w;
  const t = f.time;
  let a = d.f32(0);
  a += lobe(x, lobeCenter(-0.14, d.f32(0), t), 0.13, f.low);
  a += lobe(x, lobeCenter(0.01, d.f32(1), t), 0.12, f.mid);
  a += lobe(x, lobeCenter(0.15, d.f32(2), t), 0.11, f.high);
  a += lobe(x, lobeCenter(d.f32(0), d.f32(3), t), 0.24, f.level);
  a *= 1 - std.smoothstep(bottomRun - 12, bottomRun + arc * 0.35, std.abs(s));
  a *= (1 - f.gather * 0.85) * amp;
  a +=
    f.gather *
    (1 - f.leave) *
    beamAt(s, beam) *
    withinCorner(s, bottomRun, arc);
  return std.min(1.15, a);
};

const distanceInside = (p: d.v2f): number => {
  'use gpu';
  const f = layout.$.frame;
  const tall = f.size.y + 1000;
  const center = d.vec2f(f.size.x / 2, f.size.y - tall / 2);
  const halfSize = d.vec2f(f.size.x / 2, tall / 2);
  const q = std.abs(p.sub(center)).sub(halfSize.sub(d.vec2f(f.radius)));
  const outside =
    std.length(std.max(q, d.vec2f(0))) +
    std.min(std.max(q.x, q.y), 0) -
    f.radius;
  return -outside;
};

const alongEdge = (p: d.v2f): number => {
  'use gpu';
  const f = layout.$.frame;
  const w = f.size.x;
  const r = f.radius;
  const bottomRun = w / 2 - r;
  const arc = QUARTER_TURN * r;
  if (p.x >= r && p.x <= w - r) {
    return p.x - w / 2;
  }
  const side = std.select(d.f32(1), d.f32(-1), p.x < r);
  const cornerX = std.select(w - r, r, p.x < r);
  const cornerY = f.size.y - r;
  if (p.y >= cornerY) {
    const angle = std.atan2(std.abs(p.x - cornerX), p.y - cornerY);
    return side * (bottomRun + angle * r);
  }
  return side * (bottomRun + arc + (cornerY - p.y));
};

const createPipeline = (root: TgpuRoot, format: GPUTextureFormat) =>
  root.createRenderPipeline({
    vertex: ({ $vertexIndex }) => {
      'use gpu';
      const corner = d.vec2f(
        std.select(d.f32(-1), d.f32(3), $vertexIndex === 1),
        std.select(d.f32(-1), d.f32(3), $vertexIndex === 2)
      );
      const size = layout.$.frame.size;
      return {
        $position: d.vec4f(corner.x, corner.y, 0, 1),
        point: d.vec2f(
          ((corner.x + 1) / 2) * size.x,
          ((1 - corner.y) / 2) * size.y
        ),
      };
    },
    fragment: ({ point }) => {
      'use gpu';
      const f = layout.$.frame;
      const w = f.size.x;
      const h = f.size.y;
      const half = w / 2;
      const r = f.radius;
      const bottomRun = half - r;
      const arc = QUARTER_TURN * r;
      const edgeEnd = bottomRun + arc * 0.75;
      const maxH = f.maxHeight;
      const amp =
        std.smoothstep(0.35, 1, f.enterTime / ENTER_SECONDS) * (1 - f.leave);
      const beam = edgeEnd * 0.97 * std.sin(f.processTime * BEAM_SPEED);
      const drift = f.time * HUE_DRIFT;

      let haloColor = d.vec3f(0);
      let haloAlpha = d.f32(0);
      for (let i = 0; i < 4; i++) {
        const fi = d.f32(i);
        const base = std.select(
          std.select(
            std.select(d.f32(0), d.f32(0.15), i === 2),
            d.f32(0.01),
            i === 1
          ),
          d.f32(-0.14),
          i === 0
        );
        const width = std.select(
          std.select(
            std.select(d.f32(0.24), d.f32(0.11), i === 2),
            d.f32(0.12),
            i === 1
          ),
          d.f32(0.13),
          i === 0
        );
        const energy = std.select(
          std.select(std.select(f.level, f.high, i === 2), f.mid, i === 1),
          f.low,
          i === 0
        );
        const s = lobeCenter(base, fi, f.time) * w;
        const ry = std.max(6, heightAt(s, beam, amp) * maxH * 1.15);
        const rx = width * w * 0.9;
        const dx = (point.x - (half + s)) / rx;
        const dy = (point.y - h) / ry;
        const fall = std.max(0, 1 - std.sqrt(dx * dx + dy * dy));
        const a = HALO * energy * fall * (1 - f.gather) * amp;
        haloColor = haloColor.add(
          samplePalette(s / (w * HUE_SPAN) + drift).mul(a)
        );
        haloAlpha += a;
      }
      const beamX = std.clamp(beam, -bottomRun, bottomRun);
      const bdx = (point.x - (half + beamX)) / 36;
      const bdy = (point.y - h) / std.max(6, beamAt(beamX, beam) * maxH * 1.15);
      const beamFall = std.max(0, 1 - std.sqrt(bdx * bdx + bdy * bdy));
      const beamHalo = HALO * 0.75 * beamFall * f.gather * (1 - f.leave);
      haloColor = haloColor.add(
        samplePalette(beamX / (w * HUE_SPAN) + drift).mul(beamHalo)
      );
      haloAlpha = std.min(1, haloAlpha + beamHalo);

      const cols = std.floor(w / PITCH);
      const left = (w - cols * PITCH) / 2;
      const c = std.floor((point.x - left) / PITCH);
      const row = std.floor((h - point.y) / PITCH);
      const cell = d.vec2f(left + (c + 0.5) * PITCH, h - (row + 0.5) * PITCH);
      const offset = std.abs(point.sub(cell));
      const coverage = std.clamp(
        (PIXEL / 2 - std.max(offset.x, offset.y)) * f.pixelScale + 0.5,
        0,
        1
      );

      let pixelAlpha = d.f32(0);
      let pixelColor = d.vec3f(0);
      const u = distanceInside(cell);
      if (coverage > 0 && u >= 1 && c >= 0 && c < cols && u < maxH * 1.2 + 4) {
        const s = alongEdge(cell);
        const reach = heightAt(s, beam, amp) * maxH;
        const density = std.select(d.f32(-1), 1 - u / reach, reach > MIN_REACH);
        let a = d.f32(0);
        if (density > bayer4(c, row) * 0.9 + 0.08) {
          a = 0.4 + 0.6 * std.min(1, density * 1.5);
        }
        const whiten = std.select(
          d.f32(0),
          (CORE_WHITENING * (density - 0.6)) / 0.4,
          density > 0.6
        );
        pixelColor = std.mix(
          samplePalette(s / (w * HUE_SPAN) + drift + (u / maxH) * HUE_RISE),
          d.vec3f(1),
          std.clamp(whiten, 0, 1)
        );
        pixelAlpha = a * coverage;
      }

      const topAlpha = pixelAlpha;
      const topColor = pixelColor;
      const under = haloColor.mul(1 - topAlpha);
      return d.vec4f(
        topColor.mul(topAlpha).add(under),
        topAlpha + haloAlpha * (1 - topAlpha)
      );
    },
    targets: {
      format,
      blend: {
        color: {
          srcFactor: 'one',
          dstFactor: 'one-minus-src-alpha',
          operation: 'add',
        },
        alpha: {
          srcFactor: 'one',
          dstFactor: 'one-minus-src-alpha',
          operation: 'add',
        },
      },
    },
    primitive: { topology: 'triangle-list' },
  });

const paletteValues = (palette: readonly Rgb[]) =>
  palette.map(([r, g, b]) => d.vec4f(r / 255, g / 255, b / 255, 1));

export const prepareVoiceDome = (
  root: TgpuRoot,
  format: GPUTextureFormat,
  colors: readonly Rgb[]
) => {
  const frame = root.createBuffer(Frame).$usage('uniform');
  const palette = root
    .createBuffer(Palette, paletteValues(colors))
    .$usage('uniform');
  return {
    device: root.device,
    pipeline: root.unwrap(createPipeline(root, format)),
    group: root.unwrap(root.createBindGroup(layout, { frame, palette })),
    frameBuffer: root.unwrap(frame),
    writePalette: (next: readonly Rgb[]) => palette.write(paletteValues(next)),
  };
};
