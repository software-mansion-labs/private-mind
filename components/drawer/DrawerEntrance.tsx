import React, { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useDrawerProgress } from 'expo-router/drawer';
import {
  DRAWER_ENTRANCE_DRIFT_RATIO,
  DRAWER_ENTRANCE_SCALE,
  getDrawerWidth,
} from '../../constants/drawer-layout';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';

interface Props {
  children: ReactNode;
}

const DrawerEntrance = ({ children }: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const progress = useDrawerProgress();
  const { width } = useWindowDimensions();
  const closedOffset = -getDrawerWidth(width) * DRAWER_ENTRANCE_DRIFT_RATIO;

  const entranceStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.get(), [0, 1], [closedOffset, 0]) },
      {
        scale: interpolate(progress.get(), [0, 1], [DRAWER_ENTRANCE_SCALE, 1]),
      },
    ],
  }));

  const veilStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.get(),
  }));

  return (
    <Animated.View style={[styles.container, entranceStyle]}>
      {children}
      <Animated.View pointerEvents="none" style={[styles.veil, veilStyle]} />
    </Animated.View>
  );
};

export default DrawerEntrance;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    veil: {
      ...StyleSheet.absoluteFill,
      backgroundColor: theme.bg.softPrimary,
    },
  });
