import { EdgeInsets } from 'react-native-safe-area-context';

const BRAND_BLUE = '#3D61D6';

export const lightTheme = {
  bg: {
    main: BRAND_BLUE,
    softPrimary: '#ffffff',
    softSecondary: '#e6e7eb',
    softTertiary: '#F6F7FB',
    whatsNewCard: '#F6F7FB',
    glassFallback: 'rgba(255, 255, 255, 0.94)',
    glassTint: 'rgba(255, 255, 255, 0.7)',
    dialogAction: 'rgba(2, 15, 60, 0.07)',
    switchThumb: '#ffffff',
    strongPrimary: '#020f3c',
    chatBar: '#F6F7FB',
    chatBarBadge: '#FFFFFF',
    popover: '#FFFFFF',
    popoverScrim: 'rgba(2, 15, 60, 0.12)',
    titlePressed: '#E6E7EB',
    popoverControl: 'rgba(2, 15, 60, 0.05)',
    cardSurface: '#E4E4E7',
    cardSelected: '#F6F7F9',
    tile: '#E6E7EB',
    attachButton: '#3D61D6',
    voiceModeSurface: 'rgba(2, 15, 60, 0.2)',
    errorSecondary: '#F5D0D1',
    errorPrimary: '#DE595B',
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
    accent: '#3D61D6',
  },
  border: {
    soft: 'rgba(2, 15, 60, 0.2)',
    chatBar: 'rgba(2, 15, 60, 0.08)',
    popover: 'rgba(2, 15, 60, 0.1)',
    contrast: '#fff',
    codeInline: 'rgba(0, 0, 0, 0.08)',
    codeInlineStrong: 'rgba(255, 255, 255, 0.1)',
  },
  label: {
    red: { background: '#FEBFBA', foreground: '#770212' },
    orange: { background: '#FFE5D7', foreground: '#713401' },
    gold: { background: '#E8D170', foreground: '#493C00' },
    lime: { background: '#E1F4C1', foreground: '#3D5002' },
    green: { background: '#A0E69E', foreground: '#014B0A' },
    mint: { background: '#79EAC2', foreground: '#024936' },
    cyan: { background: '#B9F8FF', foreground: '#015258' },
    sky: { background: '#98DBFF', foreground: '#03435C' },
    blue: { background: '#DBEEFE', foreground: '#014C78' },
    periwinkle: { background: '#BBD1FF', foreground: '#11338A' },
    violet: { background: '#D9C6FE', foreground: '#4B1F7E' },
    lilac: { background: '#F7E3FF', foreground: '#66247C' },
    pink: { background: '#FFB7E6', foreground: '#6B0755' },
  },
};

export const darkTheme = {
  bg: {
    main: BRAND_BLUE,
    softPrimary: '#000000',
    softSecondary: '#121212',
    softTertiary: '#121212',
    whatsNewCard: '#121212',
    glassFallback: 'rgba(44, 44, 48, 0.92)',
    glassTint: 'rgba(255, 255, 255, 0.12)',
    dialogAction: 'rgba(255, 255, 255, 0.16)',
    switchThumb: '#ffffff',
    strongPrimary: '#FFFFFF',
    chatBar: '#1C1C1E',
    chatBarBadge: 'rgba(255, 255, 255, 0.08)',
    popover: '#2A2A2D',
    popoverScrim: 'rgba(0, 0, 0, 0.5)',
    titlePressed: 'rgba(255, 255, 255, 0.12)',
    popoverControl: 'rgba(255, 255, 255, 0.08)',
    cardSurface: '#121212',
    cardSelected: '#121212',
    tile: '#1C1C1E',
    attachButton: '#000000',
    // Voice mode sits on `bg.main` in both themes, so use the same tint here
    // for parity across light and dark.
    voiceModeSurface: 'rgba(2, 15, 60, 0.2)',
    errorSecondary: '#8B2728',
    errorPrimary: '#DE595B',
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
    onChatBar: '#FFFFFF',
    onChatBarMuted: 'rgba(255, 255, 255, 0.6)',
    onAttachButton: '#ffffff',
    error: '#E68485',
    warning: '#F0A860',
    onBrand: '#ffffff',
    accent: '#8FA8FF',
  },
  border: {
    soft: 'rgba(255, 255, 255, 0.15)',
    chatBar: 'rgba(255, 255, 255, 0.08)',
    popover: 'rgba(255, 255, 255, 0.12)',
    contrast: '#FFFFFF',
    codeInline: 'rgba(255, 255, 255, 0.1)',
    codeInlineStrong: 'rgba(255, 255, 255, 0.1)',
  },
  label: {
    red: { background: 'rgba(226, 72, 74, 0.24)', foreground: '#FFA09A' },
    orange: { background: 'rgba(230, 128, 58, 0.24)', foreground: '#FEC29E' },
    gold: { background: 'rgba(157, 133, 7, 0.24)', foreground: '#D9BD44' },
    lime: { background: 'rgba(139, 173, 53, 0.24)', foreground: '#C3DD93' },
    green: { background: 'rgba(29, 161, 43, 0.24)', foreground: '#83D582' },
    mint: { background: 'rgba(9, 157, 120, 0.24)', foreground: '#49DAAC' },
    cyan: { background: 'rgba(12, 179, 192, 0.24)', foreground: '#79E4EF' },
    sky: { background: 'rgba(3, 146, 196, 0.24)', foreground: '#60CBFF' },
    blue: { background: 'rgba(55, 166, 244, 0.24)', foreground: '#A8D7FF' },
    periwinkle: {
      background: 'rgba(73, 126, 247, 0.24)',
      foreground: '#9DBDFF',
    },
    violet: { background: 'rgba(153, 100, 229, 0.24)', foreground: '#C9ACFF' },
    lilac: { background: 'rgba(194, 127, 221, 0.24)', foreground: '#EBBDFE' },
    pink: { background: 'rgba(204, 77, 169, 0.24)', foreground: '#F999DA' },
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
