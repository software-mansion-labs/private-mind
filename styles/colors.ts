import { EdgeInsets } from 'react-native-safe-area-context';

export const lightTheme = {
  bg: {
    main: '#3D61D6',
    softPrimary: '#ffffff',
    softSecondary: '#e6e7eb',
    strongPrimary: '#020f3c',
    chatBar: '#E4E4E7',
    cardSurface: '#E4E4E7',
    attachButton: '#3D61D6',
    voiceModeSurface: 'rgba(2, 15, 60, 0.2)',
    errorSecondary: '#F5D0D1',
    errorPrimary: '#DE595B',
    overlay: 'rgba(2, 15, 60, 0.2)',
    shadow: '#000000',
    lightbox: '#000000',
    lightboxControl: 'rgba(0, 0, 0, 0.5)',
    codeInline: 'rgba(0, 0, 0, 0.06)',
    codeInlineStrong: 'rgba(255, 255, 255, 0.2)',
    codeBlock: 'rgba(0, 0, 0, 0.05)',
    codeBlockStrong: 'rgba(255, 255, 255, 0.12)',
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
    main: '#3D61D6',
    softPrimary: '#000000',
    softSecondary: '#121212',
    strongPrimary: '#FFFFFF',
    chatBar: '#FFFFFF',
    cardSurface: '#121212',
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

export const withAlpha = (color: string, alpha: number) => {
  const hex = color.replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
