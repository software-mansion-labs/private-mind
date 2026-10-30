import { useWindowDimensions } from 'react-native';
import {
  CARD_INSET,
  WIDE_COLUMN_MAX_WIDTH,
  WIDE_LAYOUT_MIN_WIDTH,
} from '../constants/onboarding';

export interface OnboardingLayout {
  screenWidth: number;
  screenHeight: number;
  isWide: boolean;
  isSplit: boolean;
  panelWidth: number;
  columnLeft: number;
  columnRight: number;
}

export function onboardingLayout(
  screenWidth: number,
  screenHeight: number
): OnboardingLayout {
  const isWide = Math.min(screenWidth, screenHeight) >= WIDE_LAYOUT_MIN_WIDTH;
  const isSplit = isWide && screenWidth > screenHeight;
  const panelWidth = isSplit ? screenWidth / 2 : screenWidth;
  const columnInset = isWide
    ? Math.max((panelWidth - WIDE_COLUMN_MAX_WIDTH) / 2, CARD_INSET)
    : CARD_INSET;

  return {
    screenWidth,
    screenHeight,
    isWide,
    isSplit,
    panelWidth,
    columnLeft: screenWidth - panelWidth + columnInset,
    columnRight: columnInset,
  };
}

export function useOnboardingLayout(): OnboardingLayout {
  const { width, height } = useWindowDimensions();
  return onboardingLayout(width, height);
}
