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
    errorSecondary: '#F5D0D1',
    errorPrimary: '#DE595B',
    overlay: 'rgba(2, 15, 60, 0.2)',
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
    errorSecondary: '#8B2728',
    errorPrimary: '#DE595B',
    overlay: 'rgba(0, 0, 0, 0.6)',
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
  },
};

export type ThemeColors = typeof lightTheme;
export type Theme = ThemeColors & { insets: EdgeInsets };
