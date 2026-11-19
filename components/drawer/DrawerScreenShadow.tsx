import React from 'react';
import { BoxShadowValue, StyleSheet } from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { isDarkTheme, Theme, withAlpha } from '../../styles/colors';

const CASTER_INSET = 2;

interface Props {
  progress: SharedValue<number>;
  searchExpansion: SharedValue<number>;
  drawerWidth: number;
  cornerRadius: number;
}

const DrawerScreenShadow = ({
  progress,
  searchExpansion,
  drawerWidth,
  cornerRadius,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: Math.min(progress.get() * 4, 1) * (1 - searchExpansion.get()),
    transform: [{ translateX: progress.get() * drawerWidth }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.caster,
        { borderRadius: Math.max(cornerRadius - CASTER_INSET, 0) },
        animatedStyle,
      ]}
    />
  );
};

export default DrawerScreenShadow;

const getRaisedScreenShadow = (theme: Theme): BoxShadowValue[] => {
  const dark = isDarkTheme(theme);
  const tint = dark ? theme.bg.shadow : theme.bg.strongPrimary;
  return [
    {
      offsetX: 0,
      offsetY: 0,
      blurRadius: 3,
      color: withAlpha(tint, dark ? 0.8 : 0.18),
    },
    {
      offsetX: -6,
      offsetY: 0,
      blurRadius: 24,
      color: withAlpha(tint, dark ? 0.9 : 0.24),
    },
  ];
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    caster: {
      position: 'absolute',
      top: CASTER_INSET,
      right: CASTER_INSET,
      bottom: CASTER_INSET,
      left: CASTER_INSET,
      borderCurve: 'continuous',
      boxShadow: getRaisedScreenShadow(theme),
    },
  });
