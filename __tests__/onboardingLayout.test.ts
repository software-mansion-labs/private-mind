import { onboardingLayout } from '../hooks/useOnboardingLayout';
import {
  CARD_INSET,
  WIDE_COLUMN_MAX_WIDTH,
  WIDE_LAYOUT_MIN_WIDTH,
} from '../constants/onboarding';

describe('onboardingLayout', () => {
  it('keeps the phone layout untouched below the wide breakpoint', () => {
    expect(onboardingLayout(390, 844)).toEqual({
      screenWidth: 390,
      screenHeight: 844,
      isWide: false,
      isSplit: false,
      panelWidth: 390,
      columnLeft: CARD_INSET,
      columnRight: CARD_INSET,
    });
  });

  it('switches to the wide layout at the breakpoint', () => {
    expect(onboardingLayout(WIDE_LAYOUT_MIN_WIDTH, 960).isWide).toBe(true);
    expect(onboardingLayout(WIDE_LAYOUT_MIN_WIDTH - 1, 960).isWide).toBe(false);
  });

  it('centres copy and controls in a column no wider than the readable maximum', () => {
    const { columnLeft, columnRight, isSplit } = onboardingLayout(800, 1280);
    expect(isSplit).toBe(false);
    expect(800 - columnLeft - columnRight).toBe(WIDE_COLUMN_MAX_WIDTH);
  });

  it('splits a landscape tablet into art on the left and copy on the right', () => {
    const { isSplit, panelWidth, columnLeft, columnRight } = onboardingLayout(
      1280,
      800
    );
    expect(isSplit).toBe(true);
    expect(panelWidth).toBe(640);
    expect(columnLeft).toBeGreaterThanOrEqual(640);
    expect(1280 - columnLeft - columnRight).toBe(WIDE_COLUMN_MAX_WIDTH);
  });

  it('keeps a landscape phone on the phone layout', () => {
    const layout = onboardingLayout(844, 390);
    expect(layout.isWide).toBe(false);
    expect(layout.isSplit).toBe(false);
  });
});
