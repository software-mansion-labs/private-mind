import {
  MENU_GAP,
  MENU_GUTTER,
  MenuTarget,
  chooseSide,
  menuAnchor,
} from '../components/chat-menu/placement';
import { POPOVER_WIDTH } from '../components/menu/Popover';

const WINDOW = { width: 400, height: 800 };
const INSETS = { top: 50, bottom: 30 };
const MENU_HEIGHT = 180;

const row = (y: number, x = 16): MenuTarget => ({
  x,
  y,
  width: 280,
  height: 44,
  align: 'start',
});

describe('choosing which side of the row the menu opens on', () => {
  it('opens below a row near the top of the list', () => {
    expect(chooseSide(row(120), WINDOW.height, INSETS)).toBe('below');
  });

  it('opens above a row near the bottom of the list', () => {
    expect(chooseSide(row(680), WINDOW.height, INSETS)).toBe('above');
  });

  it('measures the free space inside the safe area', () => {
    const middle = row(380);
    expect(chooseSide(middle, WINDOW.height, INSETS)).toBe('below');
    expect(chooseSide(middle, WINDOW.height, { top: 0, bottom: 120 })).toBe(
      'above'
    );
  });
});

describe('anchoring the menu to its row', () => {
  it('hangs the menu just under the row when opening below', () => {
    const anchor = menuAnchor(
      { target: row(120), side: 'below' },
      WINDOW,
      0,
      MENU_HEIGHT
    );
    expect(anchor).toEqual({ top: 120 + 44 + MENU_GAP, left: 16 });
  });

  it('rests the menu just over the row when opening above', () => {
    const anchor = menuAnchor(
      { target: row(680), side: 'above' },
      WINDOW,
      0,
      MENU_HEIGHT
    );
    expect(anchor).toEqual({ bottom: 800 - 680 + MENU_GAP, left: 16 });
  });

  it('centres the menu under a centred target such as the chat title', () => {
    const title: MenuTarget = {
      x: 0,
      y: 100,
      width: WINDOW.width,
      height: 0,
      align: 'center',
    };
    const anchor = menuAnchor(
      { target: title, side: 'below' },
      WINDOW,
      0,
      MENU_HEIGHT
    );
    expect(anchor.left).toBe((WINDOW.width - POPOVER_WIDTH) / 2);
  });

  it('keeps the menu inside the window when the row starts too far right', () => {
    const anchor = menuAnchor(
      { target: row(120, 200), side: 'below' },
      WINDOW,
      0,
      MENU_HEIGHT
    );
    expect(anchor.left).toBe(WINDOW.width - POPOVER_WIDTH - MENU_GUTTER);
  });

  it('pins the menu to the gutter on a window narrower than the menu', () => {
    const anchor = menuAnchor(
      { target: row(120), side: 'below' },
      { width: 300, height: 800 },
      0,
      MENU_HEIGHT
    );
    expect(anchor.left).toBe(MENU_GUTTER);
  });
});

describe('staying clear of the keyboard while renaming', () => {
  const KEYBOARD = 340;

  it('lifts a menu that opened below its row over the keyboard', () => {
    const anchor = menuAnchor(
      { target: row(330), side: 'below' },
      WINDOW,
      KEYBOARD,
      MENU_HEIGHT
    );
    expect(anchor.top).toBe(800 - KEYBOARD - MENU_GAP - MENU_HEIGHT);
  });

  it('leaves a menu below its row alone when the keyboard is not in the way', () => {
    const anchor = menuAnchor(
      { target: row(60), side: 'below' },
      WINDOW,
      KEYBOARD,
      MENU_HEIGHT
    );
    expect(anchor.top).toBe(60 + 44 + MENU_GAP);
  });

  it('lifts a menu that opened above a row the keyboard covers', () => {
    const anchor = menuAnchor(
      { target: row(700), side: 'above' },
      WINDOW,
      KEYBOARD,
      MENU_HEIGHT
    );
    expect(anchor.bottom).toBe(KEYBOARD + MENU_GAP);
  });

  it('waits for the menu to be measured before lifting it', () => {
    const anchor = menuAnchor(
      { target: row(330), side: 'below' },
      WINDOW,
      KEYBOARD,
      0
    );
    expect(anchor.top).toBe(330 + 44 + MENU_GAP);
  });
});
