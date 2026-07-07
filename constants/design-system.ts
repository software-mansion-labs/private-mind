import { fontFamily } from '../styles/fontStyles';

export const space = {
  none: 0,
  half: 2,
  one: 4,
  two: 8,
  twoHalf: 10,
  three: 12,
  four: 16,
  five: 20,
  six: 24,
  eight: 32,
  ten: 40,
  twelve: 48,
  fourteen: 56,
  sixteen: 64,
  twenty: 80,
} as const;

export const radius = {
  six: 6,
  twelve: 12,
  eighteen: 18,
  full: 9999,
} as const;

export const stroke = {
  soft: 1,
  strong: 2,
} as const;

export const textStyles = {
  titleH1: {
    fontFamily: fontFamily.bold,
    fontSize: 28,
    lineHeight: 34,
  },
  titleH2: {
    fontFamily: fontFamily.medium,
    fontSize: 22,
    lineHeight: 28,
  },
  titleH3: {
    fontFamily: fontFamily.regular,
    fontSize: 18,
    lineHeight: 24,
  },
  bodySecondaryMedium: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  bodyTertiaryRegular: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  bodyTertiaryMedium: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  bodyQuaternaryMedium: {
    fontFamily: fontFamily.medium,
    fontSize: 10,
    lineHeight: 14,
  },
} as const;
