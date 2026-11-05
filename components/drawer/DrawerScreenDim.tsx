import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';

interface Props {
  progress: SharedValue<number>;
  searchExpansion: SharedValue<number>;
  drawerWidth: number;
  cornerRadius: number;
}

const DrawerScreenDim = ({
  progress,
  searchExpansion,
  drawerWidth,
  cornerRadius,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.get() * (1 - searchExpansion.get()),
    transform: [{ translateX: progress.get() * drawerWidth }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.dim, { borderRadius: cornerRadius }, animatedStyle]}
    />
  );
};

export default DrawerScreenDim;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    dim: {
      ...StyleSheet.absoluteFill,
      backgroundColor: theme.bg.overlay,
      borderCurve: 'continuous',
    },
  });
