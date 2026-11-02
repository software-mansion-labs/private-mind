import { darkTheme, lightTheme } from '../styles/colors';

const WCAG_AA_TEXT = 4.5;

type Rgba = { r: number; g: number; b: number; a: number };

const parse = (color: string): Rgba => {
  if (color.startsWith('#')) {
    return {
      r: parseInt(color.slice(1, 3), 16),
      g: parseInt(color.slice(3, 5), 16),
      b: parseInt(color.slice(5, 7), 16),
      a: 1,
    };
  }
  const [r, g, b, a = 1] = color
    .replace(/rgba?\(|\)/g, '')
    .split(',')
    .map(Number);
  return { r, g, b, a };
};

const over = (top: string, bottom: string): Rgba => {
  const t = parse(top);
  const b = parse(bottom);
  const mix = (x: number, y: number) => x * t.a + y * (1 - t.a);
  return { r: mix(t.r, b.r), g: mix(t.g, b.g), b: mix(t.b, b.b), a: 1 };
};

const luminance = ({ r, g, b }: Rgba) => {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (x: Rgba, y: Rgba) => {
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};

const themes = [
  { name: 'light', theme: lightTheme, surfaces: ['#FFFFFF', '#F6F7F9'] },
  { name: 'dark', theme: darkTheme, surfaces: ['#000000', '#121212'] },
];

describe('label palette', () => {
  it('offers the same colors in both themes', () => {
    expect(Object.keys(darkTheme.label)).toEqual(Object.keys(lightTheme.label));
  });

  describe.each(themes)('$name theme', ({ theme, surfaces }) => {
    it.each(Object.entries(theme.label))(
      '%s text stays readable on every card surface',
      (_, { background, foreground }) => {
        for (const surface of surfaces) {
          const badge = over(background, surface);
          expect(contrast(parse(foreground), badge)).toBeGreaterThanOrEqual(
            WCAG_AA_TEXT
          );
        }
      }
    );
  });
});
