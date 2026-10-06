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

export type ComposerAction = 'speech' | 'send' | 'stop';

const ACTION_LABELS: Record<ComposerAction, string> = {
  speech: 'Dictate message',
  send: 'Send message',
  stop: 'Stop generating',
};

export const MORPH_IN_MS = 170;
export const MORPH_OUT_MS = 110;
const RESTING_SCALE = 0.55;

interface Props {
  action: ComposerAction;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  dimmed?: boolean;
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
  dimmed = false,
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

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.circle,
        (disabled || dimmed || pressed) && styles.dimmed,
      ]}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={ACTION_LABELS[action]}
      accessibilityState={{ disabled, busy }}
      testID={testID}
    >
      <Reanimated.View
        style={[StyleSheet.absoluteFill, styles.fill, fillStyle]}
        pointerEvents="none"
      />
      {busy ? (
        <ActivityIndicator size="small" color={theme.text.contrastPrimary} />
      ) : (
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
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
              color={theme.text.contrastPrimary}
            />
          </Reanimated.View>
        </View>
      )}
    </Pressable>
  );
};

export default ComposerActionButton;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    circle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    fill: {
      borderRadius: 18,
      backgroundColor: theme.bg.main,
    },
    iconLayer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dimmed: {
      opacity: 0.6,
    },
  });
