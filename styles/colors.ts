import { EdgeInsets } from 'react-native-safe-area-context';

const BRAND_BLUE = '#3D61D6';

export const lightTheme = {
  bg: {
    main: BRAND_BLUE,
    softPrimary: '#ffffff',
    softSecondary: '#e6e7eb',
    dialogAction: 'rgba(2, 15, 60, 0.07)',
    switchThumb: '#ffffff',
    strongPrimary: '#020f3c',
    chatBar: '#E4E4E7',
    cardSurface: '#E4E4E7',
    attachButton: '#3D61D6',
    voiceModeSurface: 'rgba(2, 15, 60, 0.2)',
    errorSecondary: '#F5D0D1',
    errorPrimary: '#DE595B',
    warningSecondary: '#FBE8CF',
    overlay: 'rgba(0, 0, 0, 0.2)',
    shadow: '#000000',
    lightbox: '#000000',
    lightboxControl: 'rgba(0, 0, 0, 0.5)',
    codeInline: 'rgba(0, 0, 0, 0.06)',
    codeInlineStrong: 'rgba(255, 255, 255, 0.2)',
    codeBlock: 'rgba(0, 0, 0, 0.05)',
    codeBlockStrong: 'rgba(255, 255, 255, 0.12)',
    onBrandStrong: '#ffffff',
    onBrandSoft: 'rgba(255, 255, 255, 0.16)',
    onBrandShadow: '#020f3c',
  },
  text: {
    primary: '#020f3c',
    defaultSecondary: 'rgba(2, 15, 60, 0.8)',
    defaultTertiary: 'rgba(2, 15, 60, 0.6)',
    contrastTertiary: 'rgba(255, 255, 255, 0.6)',
    contrastPrimary: '#ffffff',
    onChatBar: '#020f3c',
    onChatBarMuted: 'rgba(2, 15, 60, 0.6)',
    onAttachButton: '#ffffff',
    error: '#DE595B',
    warning: '#B8630A',
    onBrand: '#ffffff',
  },
  border: {
    soft: 'rgba(2, 15, 60, 0.2)',
    contrast: '#fff',
    codeInline: 'rgba(0, 0, 0, 0.08)',
    codeInlineStrong: 'rgba(255, 255, 255, 0.1)',
  },
};

export const darkTheme = {
  bg: {
    main: BRAND_BLUE,
    softPrimary: '#000000',
    softSecondary: '#121212',
    dialogAction: 'rgba(255, 255, 255, 0.16)',
    switchThumb: '#ffffff',
    strongPrimary: '#FFFFFF',
    chatBar: '#FFFFFF',
    cardSurface: '#121212',
    attachButton: '#000000',
    // Voice mode sits on `bg.main` in both themes, so use the same tint here
    // for parity across light and dark.
    voiceModeSurface: 'rgba(2, 15, 60, 0.2)',
    errorSecondary: '#8B2728',
    errorPrimary: '#DE595B',
    warningSecondary: '#4A2E0E',
    overlay: 'rgba(0, 0, 0, 0.6)',
    shadow: '#000000',
    lightbox: '#000000',
    lightboxControl: 'rgba(0, 0, 0, 0.5)',
    codeInline: 'rgba(255, 255, 255, 0.2)',
    codeInlineStrong: 'rgba(255, 255, 255, 0.2)',
    codeBlock: 'rgba(255, 255, 255, 0.12)',
    codeBlockStrong: 'rgba(255, 255, 255, 0.12)',
    onBrandStrong: '#ffffff',
    onBrandSoft: 'rgba(255, 255, 255, 0.16)',
    onBrandShadow: '#020f3c',
  },
  text: {
    primary: '#FFFFFF',
    defaultSecondary: 'rgba(255, 255, 255, 0.8)',
    defaultTertiary: 'rgba(255, 255, 255, 0.6)',
    contrastTertiary: 'rgba(0, 0, 0, 0.6)',
    contrastPrimary: '#000000',
    onChatBar: '#000000',
    onChatBarMuted: 'rgba(0, 0, 0, 0.6)',
    onAttachButton: '#ffffff',
    error: '#E68485',
    warning: '#F0A860',
    onBrand: '#ffffff',
  },
  border: {
    soft: 'rgba(255, 255, 255, 0.15)',
    contrast: '#FFFFFF',
    codeInline: 'rgba(255, 255, 255, 0.1)',
    codeInlineStrong: 'rgba(255, 255, 255, 0.1)',
  },
};

export type ThemeColors = typeof lightTheme;
export type Theme = ThemeColors & { insets: EdgeInsets };

export const isDarkTheme = (theme: ThemeColors) =>
  theme.bg.softPrimary === darkTheme.bg.softPrimary;

const toRgb = (color: string) => {
  const hex = color.replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
};

export const withAlpha = (color: string, alpha: number) => {
  const { r, g, b } = toRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const TEXT_SELECTION = {
  selectionColor: withAlpha(BRAND_BLUE, 0.3),
  cursorColor: BRAND_BLUE,
  selectionHandleColor: BRAND_BLUE,
} as const;

export const mixColors = (from: string, to: string, t: number) => {
  const ratio = Math.min(1, Math.max(0, t));
  const a = toRgb(from);
  const b = toRgb(to);
  const channel = (start: number, end: number) =>
    Math.round(start + (end - start) * ratio)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(a.r, b.r)}${channel(a.g, b.g)}${channel(a.b, b.b)}`;
};
