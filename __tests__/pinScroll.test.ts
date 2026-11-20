import {
  floorIsOffscreen,
  floorIsOutgrown,
  lastTurnRows,
  pinFloorFor,
  pinHasMoved,
  pinIsReachable,
  pinLandingFrom,
  pinOffsetFor,
  pinReleaseTarget,
  blankLeftBehind,
  scrollButtonShows,
  stoppedTurnLandsShort,
  turnEndFor,
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

describe('pinOffsetFor', () => {
  it('rests the question just under the top padding, wherever the row was measured', () => {
    expect(pinOffsetFor(600, 100)).toBe(500 + MESSAGE_PIN_OFFSET);
  });

  it('gives the same pin for the same rows above, whatever the top padding', () => {
    const above = 500;
    expect(pinOffsetFor(100 + above, 100)).toBe(pinOffsetFor(160 + above, 160));
  });

  it('pins to the floor it reserves, however tall the answer row was when it was measured', () => {
    const geometry = {
      containerHeight: 800,
      userHeight: 60,
      listTopPadding: 100,
      listBottomPadding: 120,
    };
    const questionTop = geometry.listTopPadding + 500;
    const contentHeight =
      questionTop +
      geometry.userHeight +
      pinFloorFor(geometry) +
      geometry.listBottomPadding;

    expect(
      pinIsReachable(
        contentHeight,
        pinOffsetFor(questionTop, geometry.listTopPadding),
        geometry.containerHeight
      )
    ).toBe(true);
  });

  it('never asks for a negative offset on the first message', () => {
    expect(pinOffsetFor(100, 140)).toBe(0);
  });
});

describe('turnEndFor', () => {
  const geometry = {
    contentHeight: 2000,
    listBottomPadding: 120,
    floor: 0,
    rowHeight: 300,
  };

  it('is where the list content stops above the bottom padding', () => {
    expect(turnEndFor(geometry)).toBe(1880);
  });

  it('leaves out the blank space a floor still reserves under a short answer', () => {
    expect(turnEndFor({ ...geometry, floor: 700 })).toBe(1880 - 400);
  });

  it('ignores a floor the answer has outgrown', () => {
    expect(turnEndFor({ ...geometry, floor: 250 })).toBe(1880);
  });

  it('predicts the pin the next question lands on, before that question exists', () => {
    const listTopPadding = 100;
    const nextQuestionTop = turnEndFor({ ...geometry, floor: 700 });

    expect(pinOffsetFor(nextQuestionTop, listTopPadding)).toBe(
      nextQuestionTop - listTopPadding + MESSAGE_PIN_OFFSET
    );
  });
});

describe('pinIsReachable', () => {
  it('holds once the list ends a full viewport below the pin', () => {
    expect(pinIsReachable(1300, 500, 800)).toBe(true);
    expect(pinIsReachable(1299.5, 500, 800)).toBe(true);
  });

  it('fails while the list is still too short to scroll that far', () => {
    expect(pinIsReachable(1200, 500, 800)).toBe(false);
  });
});

describe('pinHasMoved', () => {
  it('asks for a landing when the list has not landed yet', () => {
    expect(pinHasMoved(null, 500)).toBe(true);
  });

  it('leaves a landed pin alone', () => {
    expect(pinHasMoved(500, 500)).toBe(false);
    expect(pinHasMoved(500, 500.5)).toBe(false);
  });

  it('asks again once the question has shifted under the landed list', () => {
    expect(pinHasMoved(500, 540)).toBe(true);
    expect(pinHasMoved(500, 460)).toBe(true);
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

describe('blankLeftBehind', () => {
  const geometry = { contentHeight: 2000, layoutHeight: 800, extraPadding: 0 };

  it('is the distance scrolled up from the end of the list', () => {
    expect(blankLeftBehind({ ...geometry, offset: 1050 })).toBe(150);
  });

  it('is nothing while the list rests at its end', () => {
    expect(blankLeftBehind({ ...geometry, offset: 1200 })).toBe(0);
  });

  it('is nothing while the list is overscrolled past its end', () => {
    expect(blankLeftBehind({ ...geometry, offset: 1230 })).toBe(0);
  });

  it('counts padding added below the content as part of the list', () => {
    expect(
      blankLeftBehind({ ...geometry, extraPadding: 300, offset: 1400 })
    ).toBe(100);
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

describe('scrollButtonShows', () => {
  it('offers the jump once the reader is genuinely behind the end', () => {
    expect(scrollButtonShows(false, false)).toBe(true);
  });

  it('stays away while the sent question is still flying to its pin', () => {
    expect(scrollButtonShows(false, true)).toBe(false);
  });

  it('is gone at the end of the list, pin or no pin', () => {
    expect(scrollButtonShows(true, false)).toBe(false);
    expect(scrollButtonShows(true, true)).toBe(false);
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

describe('stoppedTurnLandsShort', () => {
  const settled = {
    turnWasStopped: true,
    isGenerating: false,
    floorStillReserved: false,
    atBottom: true,
  };

  it('settles a stop taken while following the answer, where the marker lands below the fold', () => {
    expect(stoppedTurnLandsShort(settled)).toBe(true);
  });

  it('leaves a turn that finished on its own alone', () => {
    expect(stoppedTurnLandsShort({ ...settled, turnWasStopped: false })).toBe(
      false
    );
  });

  it('waits until the turn has actually come to a halt', () => {
    expect(stoppedTurnLandsShort({ ...settled, isGenerating: true })).toBe(
      false
    );
  });

  it('leaves the reserved floor alone, because the marker is already inside it', () => {
    expect(
      stoppedTurnLandsShort({ ...settled, floorStillReserved: true })
    ).toBe(false);
  });

  it('does not yank the list back down under someone who scrolled away', () => {
    expect(stoppedTurnLandsShort({ ...settled, atBottom: false })).toBe(false);
  });
});
