import { mixColors } from '../styles/colors';

const WHITE = '#ffffff';
const BRAND = '#3758f9';
const ANCHOR = 240;
const ROOT_HEIGHT = 2244;
const WINDOW_HEIGHT = 2340;

const sample = (y: number, span: number) =>
  mixColors(WHITE, BRAND, span > 0 ? y / span : 0);

const channels = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

const distance = (a: string, b: string) =>
  Math.max(...channels(a).map((v, i) => Math.abs(v - channels(b)[i])));

describe('empty-chat fade colours', () => {
  it('is a flat white block while the root has no measurement', () => {
    expect(sample(ANCHOR, 0)).toBe(sample(0, ROOT_HEIGHT));
  });

  it('separates the two stops once a span is known', () => {
    expect(
      distance(sample(0, ROOT_HEIGHT), sample(ANCHOR, ROOT_HEIGHT))
    ).toBeGreaterThan(8);
  });

  it('lands within a shade of the measured colour when the window stands in', () => {
    expect(
      distance(sample(ANCHOR, WINDOW_HEIGHT), sample(ANCHOR, ROOT_HEIGHT))
    ).toBeLessThanOrEqual(1);
  });
});
