import {
  SCROLL_BUTTON_END_SLACK_PX,
  MESSAGE_PIN_LANDING_SLACK_PX,
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

export interface PinReach {
  contentHeight: number;
  layoutHeight: number;
  target: number;
}

export const pinTargetReachable = ({
  contentHeight,
  layoutHeight,
  target,
}: PinReach): boolean =>
  contentHeight - layoutHeight >= target - PIN_READY_SLACK_PX;

export const pinLandedShort = (offset: number, target: number) =>
  target - offset > MESSAGE_PIN_LANDING_SLACK_PX;

export const floorIsOffscreen = (offset: number, releaseTarget: number) =>
  offset <= releaseTarget + PIN_READY_SLACK_PX;

export const floorIsOutgrown = (floor: number, rowHeight: number) =>
  floor > 0 && rowHeight >= floor;

export interface ListEnd {
  offset: number;
  contentHeight: number;
  layoutHeight: number;
  bottomInset?: number;
  floorTarget: number | null;
  pinInFlight?: boolean;
}

export const atListEnd = ({
  offset,
  contentHeight,
  layoutHeight,
  bottomInset = 0,
  floorTarget,
  pinInFlight = false,
}: ListEnd): boolean => {
  if (pinInFlight) return true;
  if (floorTarget !== null && offset >= floorTarget - PIN_READY_SLACK_PX) {
    return true;
  }
  return (
    contentHeight + bottomInset - (offset + layoutHeight) <
    SCROLL_BUTTON_END_SLACK_PX
  );
};

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
