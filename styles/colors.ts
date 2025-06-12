export const lightTheme = {
  bg: {
    softPrimary: '#ffffff',
    softSecondary: '#e6efff',
    strongPrimary: '#020f3c',
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
    error: '#DE595B',
  },
  border: {
    soft: 'rgba(2, 15, 60, 0.2)',
  },
};

export const darkTheme = {
  bg: {
    softPrimary: '#020F3C',
    softSecondary: '#3D61D6',
    strongPrimary: '#FFFFFF',
    errorSecondary: '#8B2728',
    errorPrimary: '#DE595B',
    overlay: 'rgba(255, 255, 255, 0.4)',
  },
  text: {
    primary: '#FFFFFF',
    defaultSecondary: 'rgba(255, 255, 255, 0.8)',
    defaultTertiary: 'rgba(255, 255, 255, 0.6)',
    contrastTertiary: 'rgba(2, 15, 60, 0.6)',
    contrastPrimary: '#020F3C',
    error: '#E68485',
  },
  border: {
    soft: 'rgba(255, 255, 255, 0.2)',
  },
};

// export const darkTheme = {
//   bg: {
//     softPrimary: '#020F3C',
//     softSecondary: '#3D61D6',
//     strongPrimary: '#FFFFFF',
//     errorSecondary: '#8B2728',
//     errorPrimary: '#DE595B',
//   },
//   text: {
//     primary: '#FFFFFF',
//     defaultSecondary: 'rgba(255, 255, 255, 0.8)',
//     defaultTertiary: 'rgba(255, 255, 255, 0.6)',
//     contrastTertiary: 'rgba(2, 15, 60, 0.6)',
//     contrastPrimary: '#020F3C',
//     error: '#E68485',
//   },
//   border: {
//     soft: 'rgba(255, 255, 255, 0.2)',
//   },
// };

export type ThemeType = typeof lightTheme;
