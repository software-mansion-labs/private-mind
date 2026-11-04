import { isNewChatCollapsed } from '../components/drawer/newChatCollapse';

const CONTENT_HEIGHT = 2000;
const VIEWPORT_HEIGHT = 800;
const MAX_OFFSET = CONTENT_HEIGHT - VIEWPORT_HEIGHT;

const collapsedAt = (offset: number) =>
  isNewChatCollapsed({
    offset,
    contentHeight: CONTENT_HEIGHT,
    viewportHeight: VIEWPORT_HEIGHT,
  });

describe('isNewChatCollapsed', () => {
  it('stays expanded at the top', () => {
    expect(collapsedAt(0)).toBe(false);
  });

  it('stays expanded through an overscroll at the top', () => {
    expect(collapsedAt(-40)).toBe(false);
  });

  it('stays expanded inside the top zone', () => {
    expect(collapsedAt(8)).toBe(false);
  });

  it('collapses once scrolled past the top zone', () => {
    expect(collapsedAt(9)).toBe(true);
  });

  it('stays collapsed anywhere below the top, whichever way the list last moved', () => {
    expect(collapsedAt(600)).toBe(true);
    expect(collapsedAt(300)).toBe(true);
  });

  it('stays collapsed through an overscroll at the bottom', () => {
    expect(collapsedAt(MAX_OFFSET + 60)).toBe(true);
  });

  it('stays expanded when a list too short to scroll bounces', () => {
    expect(
      isNewChatCollapsed({
        offset: 30,
        contentHeight: 400,
        viewportHeight: VIEWPORT_HEIGHT,
      })
    ).toBe(false);
  });
});
