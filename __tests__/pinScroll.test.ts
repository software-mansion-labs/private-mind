import {
  floorIsOffscreen,
  pinFloorFor,
  pinLandingFrom,
  pinReleaseTarget,
} from '../components/chat-screen/pinScroll';
import {
  MESSAGE_PIN_LANDING_PX,
  MESSAGE_PIN_OFFSET,
} from '../constants/chat-screen';

describe('pinFloorFor', () => {
  const geometry = {
    containerHeight: 800,
    userHeight: 60,
    listTopPadding: 100,
    listBottomPadding: 120,
  };

  it('sizes the answer row so the list ends exactly one viewport below the pinned question', () => {
    const above = 500;
    const questionTop = geometry.listTopPadding + above;
    const pinOffset =
      questionTop - geometry.listTopPadding + MESSAGE_PIN_OFFSET;
    const contentHeight =
      geometry.listTopPadding +
      above +
      geometry.userHeight +
      pinFloorFor(geometry) +
      geometry.listBottomPadding;

    expect(contentHeight - geometry.containerHeight).toBe(pinOffset);
  });

  it('reserves nothing once the question alone fills the viewport', () => {
    expect(pinFloorFor({ ...geometry, userHeight: 900 })).toBe(0);
  });
});

describe('pinLandingFrom', () => {
  it('jumps to the landing distance and animates the rest', () => {
    expect(pinLandingFrom(0, 1000)).toEqual({
      jumpTo: 1000 - MESSAGE_PIN_LANDING_PX,
      animateTo: 1000,
    });
  });

  it('only animates when the list is already within the landing distance', () => {
    expect(pinLandingFrom(980, 1000)).toEqual({
      jumpTo: null,
      animateTo: 1000,
    });
  });

  it('only animates when the pin is closer to the top than the landing distance', () => {
    expect(pinLandingFrom(0, 40)).toEqual({ jumpTo: null, animateTo: 40 });
  });

  it('animates back down when the list sits past the pin', () => {
    expect(pinLandingFrom(1200, 1000)).toEqual({
      jumpTo: null,
      animateTo: 1000,
    });
  });
});

describe('pinReleaseTarget', () => {
  const geometry = {
    contentHeight: 2000,
    layoutHeight: 800,
    floor: 700,
    rowHeight: 300,
    extraPadding: 0,
  };

  it('is the natural end once the floor is gone', () => {
    expect(pinReleaseTarget(geometry)).toBe(2000 - (700 - 300) - 800);
  });

  it('ignores a floor the answer has outgrown', () => {
    expect(pinReleaseTarget({ ...geometry, rowHeight: 900 })).toBe(1200);
  });

  it('keeps the grown bar padding scrollable', () => {
    expect(pinReleaseTarget({ ...geometry, extraPadding: 40 })).toBe(840);
  });

  it('clamps at the top for a list shorter than the viewport', () => {
    expect(
      pinReleaseTarget({ ...geometry, contentHeight: 500, rowHeight: 100 })
    ).toBe(0);
  });
});

describe('floorIsOffscreen', () => {
  it('holds once the natural end sits at or below the viewport bottom', () => {
    expect(floorIsOffscreen(800, 800)).toBe(true);
    expect(floorIsOffscreen(700, 800)).toBe(true);
    expect(floorIsOffscreen(800.5, 800)).toBe(true);
  });

  it('fails while reserved blank space is still in view', () => {
    expect(floorIsOffscreen(830, 800)).toBe(false);
  });
});
