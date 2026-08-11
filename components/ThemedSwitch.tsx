import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Switch } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { Theme } from '../styles/colors';
import {
  SWITCH_THUMB_INSET,
  SWITCH_THUMB_SIZE,
  SWITCH_THUMB_TRAVEL,
  SWITCH_TOGGLE_DURATION,
  SWITCH_TRACK_HEIGHT,
  SWITCH_TRACK_WIDTH,
} from '../constants/switch';

interface Props {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export const ThemedSwitch = ({ value, onValueChange, disabled }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.set(
      withTiming(value ? 1 : 0, { duration: SWITCH_TOGGLE_DURATION })
    );
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.get(),
      [0, 1],
      [theme.border.soft, theme.bg.main]
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.get() * SWITCH_THUMB_TRAVEL }],
  }));

  if (Platform.OS !== 'android') {
    return (
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: theme.border.soft, true: theme.bg.main }}
        ios_backgroundColor={theme.border.soft}
      />
    );
  }

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onValueChange(!value)}
      style={disabled && styles.disabled}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    track: {
      width: SWITCH_TRACK_WIDTH,
      height: SWITCH_TRACK_HEIGHT,
      borderRadius: SWITCH_TRACK_HEIGHT / 2,
      padding: SWITCH_THUMB_INSET,
      justifyContent: 'center',
    },
    thumb: {
      width: SWITCH_THUMB_SIZE,
      height: SWITCH_THUMB_SIZE,
      borderRadius: SWITCH_THUMB_SIZE / 2,
      backgroundColor: theme.bg.switchThumb,
      elevation: 2,
      shadowColor: theme.bg.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
    },
    disabled: {
      opacity: 0.5,
    },
  });
