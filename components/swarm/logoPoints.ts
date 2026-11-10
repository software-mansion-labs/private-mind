export const APP_LOGO_PATH =
  'M270.5 0C419.893 0 541 118.742 541 265.217V530.435H419.275V610H338.125V450.87H459.85V265.217C459.85 162.685 375.075 79.5652 270.5 79.5652C165.925 79.5652 81.15 162.685 81.15 265.217C81.15 349.318 138.185 420.356 216.4 443.18V610H135.25V494.946C54.3991 449.089 0 363.384 0 265.217C0 118.742 121.107 0 270.5 0Z';

type Point = readonly [number, number];

const CURVE_STEPS = 16;
const ROW_HEIGHT = Math.sqrt(3) / 2;
const JITTER = 0.3;
const SPACING_SHRINK = 0.97;

const cubicPoint = (
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number
): Point => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const e = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1],
  ];
};

export const flattenPath = (path: string): Point[] => {
  const tokens = path.match(/[MLHVCZ]|-?\d*\.?\d+/gi) ?? [];
  const points: Point[] = [];
  let index = 0;
  let command = '';
  let current: Point = [0, 0];
  const next = () => parseFloat(tokens[index++]);

  while (index < tokens.length) {
    if (/[A-Z]/i.test(tokens[index])) command = tokens[index++].toUpperCase();
    if (command === 'Z') continue;
    if (command === 'M' || command === 'L') {
      current = [next(), next()];
      points.push(current);
      if (command === 'M') command = 'L';
    } else if (command === 'H') {
      current = [next(), current[1]];
      points.push(current);
    } else if (command === 'V') {
      current = [current[0], next()];
      points.push(current);
    } else if (command === 'C') {
      const c1: Point = [next(), next()];
      const c2: Point = [next(), next()];
      const end: Point = [next(), next()];
      for (let step = 1; step <= CURVE_STEPS; step++) {
        points.push(cubicPoint(current, c1, c2, end, step / CURVE_STEPS));
      }
      current = end;
    } else {
      throw new Error(`Unsupported path command: ${command}`);
    }
  }
  return points;
};

export const isInside = (polygon: readonly Point[], [x, y]: Point) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

const polygonArea = (polygon: readonly Point[]) => {
  let sum = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    sum += polygon[j][0] * polygon[i][1] - polygon[i][0] * polygon[j][1];
  }
  return Math.abs(sum) / 2;
};

export const seededRandom = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const scatterOnHexGrid = (
  polygon: readonly Point[],
  spacing: number,
  random: () => number
) => {
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const found: Point[] = [];
  let row = 0;
  for (let y = minY + spacing / 2; y < maxY; y += spacing * ROW_HEIGHT) {
    const offset = row++ % 2 ? spacing / 2 : 0;
    for (let x = minX + offset; x < maxX; x += spacing) {
      const candidate: Point = [
        x + (random() - 0.5) * 2 * JITTER * spacing,
        y + (random() - 0.5) * 2 * JITTER * spacing,
      ];
      if (isInside(polygon, candidate)) found.push(candidate);
    }
  }
  return found;
};

export const sampleLogo = (
  count: number,
  seed: number,
  path: string = APP_LOGO_PATH
): Point[] => {
  const polygon = flattenPath(path);
  const random = seededRandom(seed);
  let spacing = Math.sqrt(polygonArea(polygon) / count);
  let found = scatterOnHexGrid(polygon, spacing, random);
  while (found.length < count) {
    spacing *= SPACING_SHRINK;
    found = scatterOnHexGrid(polygon, spacing, random);
  }
  for (let i = found.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [found[i], found[j]] = [found[j], found[i]];
  }

  const ys = polygon.map((p) => p[1]);
  const xs = polygon.map((p) => p[0]);
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const scale = 2 / (Math.max(...ys) - Math.min(...ys));
  return found
    .slice(0, count)
    .map(([x, y]) => [(x - centerX) * scale, -(y - centerY) * scale]);
};

const quadraticPoint = (p0: Point, p1: Point, p2: Point, t: number): Point => {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
  ];
};

export const flattenContours = (path: string): Point[][] => {
  const tokens = path.match(/[MLQCZ]|-?\d*\.?\d+/gi) ?? [];
  const contours: Point[][] = [];
  let contour: Point[] = [];
  let index = 0;
  let command = '';
  let current: Point = [0, 0];
  const next = () => parseFloat(tokens[index++]);
  const close = () => {
    if (contour.length > 2) contours.push(contour);
    contour = [];
  };

  while (index < tokens.length) {
    if (/[A-Z]/i.test(tokens[index])) command = tokens[index++].toUpperCase();
    if (command === 'Z') {
      close();
      continue;
    }
    if (command === 'M') {
      close();
      current = [next(), next()];
      contour.push(current);
      command = 'L';
    } else if (command === 'L') {
      current = [next(), next()];
      contour.push(current);
    } else if (command === 'Q') {
      const control: Point = [next(), next()];
      const end: Point = [next(), next()];
      for (let step = 1; step <= CURVE_STEPS; step++) {
        contour.push(quadraticPoint(current, control, end, step / CURVE_STEPS));
      }
      current = end;
    } else if (command === 'C') {
      const c1: Point = [next(), next()];
      const c2: Point = [next(), next()];
      const end: Point = [next(), next()];
      for (let step = 1; step <= CURVE_STEPS; step++) {
        contour.push(cubicPoint(current, c1, c2, end, step / CURVE_STEPS));
      }
      current = end;
    } else {
      throw new Error(`Unsupported path command: ${command}`);
    }
  }
  close();
  return contours;
};

export const isInsideContours = (
  contours: readonly (readonly Point[])[],
  point: Point
) => contours.filter((contour) => isInside(contour, point)).length % 2 === 1;

const crossingsAt = (contours: readonly (readonly Point[])[], y: number) => {
  const xs: number[] = [];
  for (const contour of contours) {
    for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
      const [xi, yi] = contour[i];
      const [xj, yj] = contour[j];
      if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
    }
  }
  return xs.sort((p, q) => p - q);
};

const crossingsBefore = (sorted: readonly number[], x: number) => {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (sorted[middle] < x) low = middle + 1;
    else high = middle;
  }
  return low;
};

const scatterOverContours = (
  contours: readonly (readonly Point[])[],
  spacing: number,
  random: () => number
) => {
  const all = contours.flat();
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const found: Point[] = [];
  let row = 0;
  for (let y = minY + spacing / 2; y < maxY; y += spacing * ROW_HEIGHT) {
    const offset = row++ % 2 ? spacing / 2 : 0;
    const crossings = crossingsAt(contours, y);
    for (let x = minX + offset; x < maxX; x += spacing) {
      const jitteredX = x + (random() - 0.5) * 2 * JITTER * spacing;
      const rowJitter = (random() - 0.5) * JITTER * spacing;
      if (crossingsBefore(crossings, jitteredX) % 2 === 1) {
        found.push([jitteredX, y + rowJitter]);
      }
    }
  }
  return found;
};

const signedArea = (polygon: readonly Point[]) => {
  let sum = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    sum += polygon[j][0] * polygon[i][1] - polygon[i][0] * polygon[j][1];
  }
  return sum / 2;
};

export const sampleOutline = (
  path: string,
  count: number,
  seed: number,
  unitsPerEm: number
): Point[] => {
  const contours = flattenContours(path);
  const random = seededRandom(seed);
  const inkArea = Math.abs(contours.reduce((sum, c) => sum + signedArea(c), 0));
  let spacing = Math.sqrt(inkArea / count);
  let found = scatterOverContours(contours, spacing, random);
  while (found.length < count) {
    spacing *= SPACING_SHRINK;
    found = scatterOverContours(contours, spacing, random);
  }
  for (let i = found.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [found[i], found[j]] = [found[j], found[i]];
  }
  return found
    .slice(0, count)
    .map(([x, y]) => [x / unitsPerEm, y / unitsPerEm]);
};
