import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useLLMStore } from '../../store/llmStore';
import { Theme } from '../../styles/colors';
import CubeIcon from '../../assets/icons/cube.svg';
import { DrawerItem } from './DrawerItem';
import {
  NAV_COLLAPSE_DURATION,
  SECTION_GAP,
} from '../../constants/drawer-layout';
import { EMPHASIZED_STANDARD } from '../../constants/motion';

const NAV_EASING = Easing.bezier(...EMPHASIZED_STANDARD);

interface Props {
  collapsed: boolean;
  height: number;
  onMeasured: (height: number) => void;
  onNavigate?: () => void;
}

export const DrawerNavSection = ({
  collapsed,
  height,
  onMeasured,
  onNavigate,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);

  const router = useRouter();
  const pathname = usePathname();
  const interrupt = useLLMStore((state) => state.interrupt);

  const [rendered, setRendered] = useState(!collapsed);
  const progress = useSharedValue(collapsed ? 0 : 1);
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    if (!collapsed) {
      setRendered(true);
      progress.set(
        withTiming(1, {
          duration: NAV_COLLAPSE_DURATION,
          easing: NAV_EASING,
        })
      );
      return;
    }

    progress.set(
      withTiming(
        0,
        { duration: NAV_COLLAPSE_DURATION, easing: NAV_EASING },
        (finished) => {
          if (finished) runOnJS(setRendered)(false);
        }
      )
    );
  }, [collapsed, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    if (!height) return {};

    return {
      height: interpolate(progress.get(), [0, 1], [0, height]),
      marginBottom: interpolate(progress.get(), [0, 1], [0, SECTION_GAP]),
      opacity: progress.get(),
    };
  }, [height]);

  const handleSectionLayout = (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.height;
    if (measured > 0) onMeasured(measured);
  };

  const goToModelHub = () => {
    interrupt();
    router.replace('/model-hub');
    onNavigate?.();
  };

  if (!rendered) return null;

  return (
    <Animated.View
      style={[styles.wrapper, animatedStyle]}
      pointerEvents={collapsed ? 'none' : 'auto'}
    >
      <View onLayout={height ? undefined : handleSectionLayout}>
        <DrawerItem
          icon={<CubeIcon width={20} height={20} style={styles.icon} />}
          label="Manage models"
          active={pathname === '/model-hub'}
          onPress={goToModelHub}
        />
      </View>
    </Animated.View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: {
      overflow: 'hidden',
      marginBottom: SECTION_GAP,
    },
    icon: {
      color: theme.text.primary,
    },
  });
