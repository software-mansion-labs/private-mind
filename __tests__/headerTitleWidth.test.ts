import {
  HEADER_BUTTON_SLOT_PX,
  HEADER_TITLE_GUTTER_PX,
  headerTitleMaxWidth,
} from '../constants/chat-screen';

const S20_FE_WIDTH = 360;
const IPHONE_17_PRO_WIDTH = 402;
const NO_INSET = { left: 0, right: 0 };

describe('headerTitleMaxWidth', () => {
  it('leaves the same gutter beside the buttons on both platforms', () => {
    for (const width of [S20_FE_WIDTH, IPHONE_17_PRO_WIDTH]) {
      const gutter =
        (width - headerTitleMaxWidth(width, NO_INSET)) / 2 -
        HEADER_BUTTON_SLOT_PX;

      expect(gutter).toBe(HEADER_TITLE_GUTTER_PX);
    }
  });

  it('beats the 80px back-button slot React Navigation reserves on iOS', () => {
    const reservedForAbsentBackButton = IPHONE_17_PRO_WIDTH - (80 + 16) * 2;

    expect(headerTitleMaxWidth(IPHONE_17_PRO_WIDTH, NO_INSET)).toBeGreaterThan(
      reservedForAbsentBackButton
    );
  });

  it('keeps the title clear of a landscape notch inset', () => {
    expect(
      headerTitleMaxWidth(IPHONE_17_PRO_WIDTH, { left: 59, right: 0 })
    ).toBe(headerTitleMaxWidth(IPHONE_17_PRO_WIDTH, NO_INSET) - 2 * 59);
  });
});
