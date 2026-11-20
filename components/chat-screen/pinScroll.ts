import {
  MESSAGE_PIN_LANDING_PX,
  MESSAGE_PIN_OFFSET,
  PIN_READY_SLACK_PX,
} from '../../constants/chat-screen';

export interface PinGeometry {
  containerHeight: number;
  userHeight: number;
  listTopPadding: number;
  listBottomPadding: number;
}

export const pinFloorFor = ({
  containerHeight,
  userHeight,
  listTopPadding,
  listBottomPadding,
}: PinGeometry): number =>
  Math.max(
    0,
    containerHeight -
      listTopPadding +
      MESSAGE_PIN_OFFSET -
      userHeight -
      listBottomPadding
  );

export const pinOffsetFor = (questionTop: number, listTopPadding: number) =>
  Math.max(0, questionTop - listTopPadding + MESSAGE_PIN_OFFSET);

export const pinIsReachable = (
  contentHeight: number,
  pinOffset: number,
  containerHeight: number
) => contentHeight >= pinOffset + containerHeight - PIN_READY_SLACK_PX;

export const pinHasMoved = (landedAt: number | null, pinOffset: number) =>
  landedAt === null || Math.abs(landedAt - pinOffset) > PIN_READY_SLACK_PX;

export interface TurnEndGeometry {
  contentHeight: number;
  listBottomPadding: number;
  floor: number;
  rowHeight: number;
}

export const turnEndFor = ({
  contentHeight,
  listBottomPadding,
  floor,
  rowHeight,
}: TurnEndGeometry): number =>
  contentHeight - listBottomPadding - Math.max(0, floor - rowHeight);

export interface PinLanding {
  jumpTo: number | null;
  animateTo: number;
}

export const pinLandingFrom = (
  current: number,
  target: number,
  landing = MESSAGE_PIN_LANDING_PX
): PinLanding => {
  const approach = Math.max(0, target - landing);
  return {
    jumpTo: current < approach ? approach : null,
    animateTo: target,
  };
};

export interface PinReleaseGeometry {
  contentHeight: number;
  layoutHeight: number;
  floor: number;
  rowHeight: number;
  extraPadding: number;
}

export const pinReleaseTarget = ({
  contentHeight,
  layoutHeight,
  floor,
  rowHeight,
  extraPadding,
}: PinReleaseGeometry): number => {
  const floorExcess = Math.max(0, floor - rowHeight);
  return Math.max(0, contentHeight - floorExcess - layoutHeight + extraPadding);
};

export interface ScrolledAwayGeometry {
  offset: number;
  contentHeight: number;
  layoutHeight: number;
  extraPadding: number;
}

export const blankLeftBehind = ({
  offset,
  contentHeight,
  layoutHeight,
  extraPadding,
}: ScrolledAwayGeometry): number =>
  Math.max(0, contentHeight - layoutHeight + extraPadding - offset);

export const floorIsOffscreen = (offset: number, releaseTarget: number) =>
  offset <= releaseTarget + PIN_READY_SLACK_PX;

export const floorIsOutgrown = (floor: number, rowHeight: number) =>
  floor > 0 && rowHeight >= floor;

export const scrollButtonShows = (atBottom: boolean, pinLanding: boolean) =>
  !atBottom && !pinLanding;

export interface LastTurnRows {
  userIndex: number;
  answerIndex: number;
}

export const lastTurnRows = (
  roles: readonly string[],
  answerIsMeasuredElsewhere = false
): LastTurnRows => {
  let userIndex = -1;
  let answerIndex = -1;

  for (let i = roles.length - 1; i >= 0; i--) {
    if (roles[i] === 'user') {
      userIndex = i;
      break;
    }
    if (
      !answerIsMeasuredElsewhere &&
      answerIndex === -1 &&
      roles[i] === 'assistant'
    ) {
      answerIndex = i;
    }
  }

  return { userIndex, answerIndex };
};

export interface StoppedTurnSettling {
  turnWasStopped: boolean;
  isGenerating: boolean;
  floorStillReserved: boolean;
  atBottom: boolean;
}

export const stoppedTurnLandsShort = ({
  turnWasStopped,
  isGenerating,
  floorStillReserved,
  atBottom,
}: StoppedTurnSettling): boolean =>
  turnWasStopped && !isGenerating && !floorStillReserved && atBottom;
