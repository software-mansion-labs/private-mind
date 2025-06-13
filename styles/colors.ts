export const lightTheme = {
  bg: {
    softPrimary: '#ffffff',
    softSecondary: '#e6efff',
    strongPrimary: '#020f3c',
    errorSecondary: '#F5D0D1',
  },
  text: {
    primary: '#020f3c',
    defaultSecondary: 'rgba(2, 15, 60, 0.8)',
    defaultTertiary: 'rgba(2, 15, 60, 0.6)',
    contrastTertiary: 'rgba(255, 255, 255, 0.6)',
    contrastPrimary: '#ffffff',
  },
  border: {
    soft: 'rgba(2, 15, 60, 0.2)',
  },
};

export const darkTheme = {
  bg: {
    softPrimary: '#ffffff',
    softSecondary: '#e6efff',
    strongPrimary: '#020f3c',
    errorSecondary: '#F5D0D1',
  },
  text: {
    primary: '#020f3c',
    defaultSecondary: 'rgba(2, 15, 60, 0.8)',
    defaultTertiary: 'rgba(2, 15, 60, 0.6)',
    contrastTertiary: 'rgba(255, 255, 255, 0.6)',
    contrastPrimary: '#ffffff',
  },
  border: {
    soft: 'rgba(2, 15, 60, 0.2)',
  },
};

export type ThemeType = typeof lightTheme;
