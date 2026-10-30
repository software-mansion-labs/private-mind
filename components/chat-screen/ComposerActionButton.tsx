import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import SendIcon from '../../assets/icons/send_icon.svg';
import PauseIcon from '../../assets/icons/pause_icon.svg';
import SoundwaveIcon from '../../assets/icons/soundwave.svg';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { composerControlSurface } from './composerControl';
import { dimmedOpacity, pressedOpacity } from '../../styles/pressable';
import { radius } from '../../constants/design-system';

export type ComposerAction = 'speech' | 'send' | 'stop';

export const MORPH_IN_MS = 170;
export const MORPH_OUT_MS = 110;
const RESTING_SCALE = 0.55;
const BUTTON_SIZE = 36;
const STOP_SIZE = 40;

interface Props {
  action: ComposerAction;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  testID?: string;
}

export const morphOpacity = (progress: number) => {
  'worklet';
  return Math.min(1, progress);
};

export const morphScale = (progress: number) => {
  'worklet';
  return RESTING_SCALE + (1 - RESTING_SCALE) * progress;
};

export const morphFillOpacity = (send: number, stop: number) => {
  'worklet';
  return Math.min(1, Math.max(send, stop));
};

export const stopGrowth = (stop: number) => {
  'worklet';
  return 1 + (STOP_SIZE / BUTTON_SIZE - 1) * stop;
};

const morphTo = (on: boolean) =>
  withTiming(on ? 1 : 0, {
    duration: on ? MORPH_IN_MS : MORPH_OUT_MS,
    easing: on ? Easing.out(Easing.back(2.2)) : Easing.in(Easing.quad),
  });

const ComposerActionButton = ({
  action,
  onPress,
  busy = false,
  disabled = false,
  testID,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const speech = useSharedValue(action === 'speech' ? 1 : 0);
  const send = useSharedValue(action === 'send' ? 1 : 0);
  const stop = useSharedValue(action === 'stop' ? 1 : 0);

  useEffect(() => {
    speech.set(morphTo(action === 'speech'));
    send.set(morphTo(action === 'send'));
    stop.set(morphTo(action === 'stop'));
  }, [action, send, speech, stop]);

  const restStyle = useAnimatedStyle(() => ({
    opacity: morphOpacity(speech.get()),
  }));
  const fillStyle = useAnimatedStyle(() => ({
    opacity: morphFillOpacity(send.get(), stop.get()),
  }));
  const speechStyle = useAnimatedStyle(() => ({
    opacity: morphOpacity(speech.get()),
    transform: [{ scale: morphScale(speech.get()) }],
  }));
  const sendStyle = useAnimatedStyle(() => ({
    opacity: morphOpacity(send.get()),
    transform: [{ scale: morphScale(send.get()) }],
  }));
  const stopStyle = useAnimatedStyle(() => ({
    opacity: morphOpacity(stop.get()),
    transform: [{ scale: morphScale(stop.get()) }],
  }));
  const stopFillStyle = useAnimatedStyle(() => ({
    opacity: morphOpacity(stop.get()),
  }));
  const growStyle = useAnimatedStyle(() => ({
    transform: [{ scale: stopGrowth(stop.get()) }],
  }));

  return (
    <Reanimated.View style={growStyle}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.circle,
          disabled && dimmedOpacity,
          pressed && pressedOpacity,
        ]}
        disabled={disabled}
        accessibilityState={{ disabled, busy }}
        testID={testID}
      >
        <Reanimated.View
          style={[StyleSheet.absoluteFill, styles.rest, restStyle]}
          pointerEvents="none"
        />
        <Reanimated.View
          style={[StyleSheet.absoluteFill, styles.fill, fillStyle]}
          pointerEvents="none"
        />
        <Reanimated.View
          style={[StyleSheet.absoluteFill, styles.stopFill, stopFillStyle]}
          pointerEvents="none"
        />
        {busy ? (
          <ActivityIndicator size="small" color={theme.text.contrastPrimary} />
        ) : (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Reanimated.View style={[styles.iconLayer, speechStyle]}>
              <SoundwaveIcon
                width={20}
                height={20}
                color={theme.text.onChatBar}
              />
            </Reanimated.View>
            <Reanimated.View style={[styles.iconLayer, sendStyle]}>
              <SendIcon
                width={20}
                height={20}
                color={theme.text.contrastPrimary}
              />
            </Reanimated.View>
            <Reanimated.View style={[styles.iconLayer, stopStyle]}>
              <PauseIcon
                width={13.33}
                height={13.33}
                color={theme.text.onBrand}
              />
            </Reanimated.View>
          </View>
        )}
      </Pressable>
    </Reanimated.View>
  );
};

export default ComposerActionButton;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    circle: {
      width: BUTTON_SIZE,
      height: BUTTON_SIZE,
      borderRadius: radius.eighteen,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    rest: {
      borderRadius: radius.eighteen,
      ...composerControlSurface(theme),
    },
    fill: {
      borderRadius: radius.eighteen,
      backgroundColor: theme.bg.main,
    },
    stopFill: {
      borderRadius: radius.eighteen,
      backgroundColor: theme.bg.errorPrimary,
    },
    iconLayer: {
      ...StyleSheet.absoluteFill,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
