import {
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

export const floorIsOffscreen = (offset: number, releaseTarget: number) =>
  offset <= releaseTarget + PIN_READY_SLACK_PX;
