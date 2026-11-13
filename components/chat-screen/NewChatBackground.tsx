import React from 'react';
import { Image, Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme, isDarkTheme, withAlpha } from '../../styles/colors';

type Glow = readonly [
  left: number,
  top: number,
  width: number,
  height: number,
  color: string,
  alpha: number,
];

interface IrisLook {
  base: string;
  glows: readonly Glow[];
  wideFalloff: boolean;
  grainOpacity: number;
}

const IRIS_LIGHT: IrisLook = {
  base: '#F6F6FC',
  glows: [
    [0, 78, 85, 55, '#4A6BE0', 0.85],
    [55, 100, 90, 50, '#9C6CF0', 0.75],
    [104, 72, 60, 45, '#F2A0CF', 0.7],
    [96, 6, 85, 55, '#B9A4F5', 0.7],
  ],
  wideFalloff: false,
  grainOpacity: 0.3,
};

const IRIS_DARK: IrisLook = {
  base: '#05040C',
  glows: [
    [0, 80, 85, 55, '#3A5AE0', 0.9],
    [55, 102, 90, 50, '#7240D0', 0.75],
    [104, 74, 60, 45, '#B03C8C', 0.65],
    [98, 4, 85, 55, '#7650D6', 0.7],
  ],
  wideFalloff: true,
  grainOpacity: 0.35,
};

const NARROW_FALLOFF = [
  [0, 1],
  [35, 0.55],
  [100, 0],
] as const;

const WIDE_FALLOFF = [
  [0, 1],
  [30, 0.72],
  [62, 0.3],
  [100, 0],
] as const;

const GRAIN = require('../../assets/textures/grain.png');

const supportsSoftLightBlend =
  Platform.OS === 'ios' ||
  (Platform.OS === 'android' && Number(Platform.Version) >= 29);

const toBackgroundImage = (look: IrisLook) => {
  const falloff = look.wideFalloff ? WIDE_FALLOFF : NARROW_FALLOFF;
  return look.glows.map(([left, top, width, height, color, alpha]) => ({
    type: 'radial-gradient' as const,
    shape: 'ellipse' as const,
    size: { x: `${width}%`, y: `${height}%` },
    position: { left: `${left}%`, top: `${top}%` },
    colorStops: falloff.map(([at, strength]) => ({
      color: withAlpha(color, alpha * strength),
      positions: [`${at}%`],
    })),
  }));
};

const LIGHT_IMAGE = toBackgroundImage(IRIS_LIGHT);
const DARK_IMAGE = toBackgroundImage(IRIS_DARK);

export const NewChatBackground = React.memo(() => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View
      style={styles.paint}
      pointerEvents="none"
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
    >
      {supportsSoftLightBlend && (
        <Image source={GRAIN} resizeMode="repeat" style={styles.grain} />
      )}
    </View>
  );
});

NewChatBackground.displayName = 'NewChatBackground';

const FILL = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const;

const createStyles = (theme: Theme) => {
  const dark = isDarkTheme(theme);
  const look = dark ? IRIS_DARK : IRIS_LIGHT;
  const paint: ViewStyle = {
    ...FILL,
    backgroundColor: look.base,
    experimental_backgroundImage: dark ? DARK_IMAGE : LIGHT_IMAGE,
  };
  return StyleSheet.create({
    paint,
    grain: {
      ...FILL,
      width: '100%',
      height: '100%',
      opacity: look.grainOpacity,
      mixBlendMode: 'soft-light',
    },
  });
};
