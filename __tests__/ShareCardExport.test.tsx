import React from 'react';
import { render, screen } from '@testing-library/react-native';
import Svg from 'react-native-svg';
import {
  SHARE_CARD_BLEED,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  ShareCard,
  shareCardSize,
} from '../components/share/ShareCard';
import { shareCardContent } from '../utils/shareUsageCard';
import { EMPTY_USAGE_TOTALS, summarizeUsage } from '../utils/usageStats';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

const content = shareCardContent(
  summarizeUsage({ ...EMPTY_USAGE_TOTALS, countedTokens: 6500 }),
  'Pixel 10'
);

const OPAQUE_ALPHA = 255;
const ALPHA_UNIT = 2 ** 24;

const alphaOf = (fill: { payload: number }) =>
  Math.floor(fill.payload / ALPHA_UNIT);

describe('the exported card geometry', () => {
  it('sizes the card in whole points at exactly the viewBox aspect, so no column is letterboxed', () => {
    for (const available of [343, 344.7, 359.4, 360, 381, 400]) {
      const { width, height } = shareCardSize(available);
      expect(Number.isInteger(width)).toBe(true);
      expect(Number.isInteger(height)).toBe(true);
      expect(width).toBeLessThanOrEqual(available);
      expect(width * SHARE_CARD_HEIGHT).toBe(height * SHARE_CARD_WIDTH);
    }
  });

  it('draws the svg at that whole size', () => {
    const view = render(<ShareCard content={content} width={359.4} />);
    const svg = view.UNSAFE_getByType(Svg);
    expect(svg.props.width).toBe(357);
    expect(svg.props.height).toBe(476);
  });

  it('paints an opaque background past every edge of the viewBox', () => {
    render(<ShareCard content={content} width={360} />);
    const base = screen.getByTestId('share-card-base');
    const { x, y, width, height, fill } = base.props;
    const toNumber = (value: unknown) => Number(value);

    expect(toNumber(x)).toBeLessThan(0);
    expect(toNumber(y)).toBeLessThan(0);
    expect(toNumber(x) + toNumber(width)).toBeGreaterThan(SHARE_CARD_WIDTH);
    expect(toNumber(y) + toNumber(height)).toBeGreaterThan(SHARE_CARD_HEIGHT);
    expect(SHARE_CARD_BLEED).toBeGreaterThan(0);
    expect(alphaOf(fill)).toBe(OPAQUE_ALPHA);
  });
});
