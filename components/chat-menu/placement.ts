import { PopoverAnchor, POPOVER_WIDTH } from '../menu/Popover';

export const MENU_GAP = 8;
export const MENU_GUTTER = 16;

export interface MenuTarget {
  x: number;
  y: number;
  width: number;
  height: number;
  align: 'start' | 'center';
}

export type MenuSide = 'below' | 'above';

export interface MenuPlacement {
  target: MenuTarget;
  side: MenuSide;
}

interface Size {
  width: number;
  height: number;
}

interface VerticalInsets {
  top: number;
  bottom: number;
}

export const chooseSide = (
  target: MenuTarget,
  windowHeight: number,
  insets: VerticalInsets
): MenuSide => {
  const spaceAbove = target.y - insets.top;
  const spaceBelow = windowHeight - insets.bottom - (target.y + target.height);
  return spaceBelow >= spaceAbove ? 'below' : 'above';
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const menuLeft = (target: MenuTarget, windowWidth: number) => {
  const preferred =
    target.align === 'center'
      ? target.x + (target.width - POPOVER_WIDTH) / 2
      : target.x;
  return clamp(
    preferred,
    MENU_GUTTER,
    Math.max(MENU_GUTTER, windowWidth - POPOVER_WIDTH - MENU_GUTTER)
  );
};

export const menuAnchor = (
  { target, side }: MenuPlacement,
  window: Size,
  keyboardHeight: number,
  menuHeight: number
): PopoverAnchor => {
  const left = menuLeft(target, window.width);

  if (side === 'above') {
    const bottom = window.height - target.y + MENU_GAP;
    return {
      bottom:
        keyboardHeight > 0
          ? Math.max(bottom, keyboardHeight + MENU_GAP)
          : bottom,
      left,
    };
  }

  const top = target.y + target.height + MENU_GAP;
  const lowestTop = window.height - keyboardHeight - MENU_GAP - menuHeight;
  return {
    top: keyboardHeight > 0 && menuHeight > 0 ? Math.min(top, lowestTop) : top,
    left,
  };
};
