import {
  floorIsOffscreen,
  floorIsOutgrown,
  lastTurnRows,
  pinFloorFor,
  pinLandedShort,
  pinTargetReachable,
  atListEnd,
  pinReleaseTarget,
} from '../components/chat-screen/pinScroll';
import {
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

describe('floorIsOutgrown', () => {
  it('holds once the answer row is at least as tall as its floor', () => {
    expect(floorIsOutgrown(700, 700)).toBe(true);
    expect(floorIsOutgrown(700, 900)).toBe(true);
  });

  it('fails while the floor still shows blank space under the answer', () => {
    expect(floorIsOutgrown(700, 699)).toBe(false);
  });

  it('never reports a row without a floor as outgrown', () => {
    expect(floorIsOutgrown(0, 300)).toBe(false);
  });
});

describe('lastTurnRows', () => {
  it('pairs the question with the answer that follows it', () => {
    expect(lastTurnRows(['user', 'assistant', 'user', 'assistant'])).toEqual({
      userIndex: 2,
      answerIndex: 3,
    });
  });

  it('leaves no answer row when the turn was stopped before one appeared', () => {
    expect(lastTurnRows(['user', 'assistant', 'user'])).toEqual({
      userIndex: 2,
      answerIndex: -1,
    });
  });

  it('leaves no answer row while the error banner is the one being measured', () => {
    expect(lastTurnRows(['user', 'assistant'], true)).toEqual({
      userIndex: 0,
      answerIndex: -1,
    });
  });
});

describe('pinLandedShort', () => {
  it('accepts a landing that stopped a pixel or two under the mark', () => {
    expect(pinLandedShort(798, 800)).toBe(false);
  });

  it('reports a question left halfway up the screen', () => {
    expect(pinLandedShort(400, 800)).toBe(true);
  });

  it('accepts a landing that went past the mark', () => {
    expect(pinLandedShort(840, 800)).toBe(false);
  });
});

describe('pinTargetReachable', () => {
  it('holds once the list can scroll as far as the mark', () => {
    expect(
      pinTargetReachable({
        contentHeight: 1800,
        layoutHeight: 800,
        target: 900,
      })
    ).toBe(true);
  });

  it('fails while the reserved space below the question has not rendered', () => {
    expect(
      pinTargetReachable({
        contentHeight: 1200,
        layoutHeight: 800,
        target: 900,
      })
    ).toBe(false);
  });

  it('does not stall on the last pixel of slack', () => {
    expect(
      pinTargetReachable({
        contentHeight: 1699,
        layoutHeight: 800,
        target: 900,
      })
    ).toBe(true);
  });
});

describe('atListEnd', () => {
  const base = {
    offset: 0,
    contentHeight: 2000,
    layoutHeight: 800,
    floorTarget: null,
  };

  it('is false when the list really does continue below the fold', () => {
    expect(atListEnd(base)).toBe(false);
  });

  it('is true once the remaining travel is within a screenful of slack', () => {
    expect(atListEnd({ ...base, offset: 1150 })).toBe(true);
  });

  it('counts the space reserved under a sent question as the end', () => {
    expect(atListEnd({ ...base, offset: 900, floorTarget: 900 })).toBe(true);
  });

  it('still reports more to come above that reserved space', () => {
    expect(atListEnd({ ...base, offset: 400, floorTarget: 900 })).toBe(false);
  });

  it('never offers to scroll down while the send is still landing', () => {
    expect(atListEnd({ ...base, pinInFlight: true })).toBe(true);
  });
});
