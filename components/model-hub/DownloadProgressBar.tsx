import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { radius } from '../../constants/design-system';
import { hasDownloadStarted } from '../../utils/downloadProgress';

const TRACK_HEIGHT = 6;
const STARTING_SEGMENT_PERCENT = 30;
const STARTING_SWEEP_MS = 1200;

interface Props {
  progress: number;
  accessibilityLabel: string;
}

const DownloadProgressBar = ({ progress, accessibilityLabel }: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const started = hasDownloadStarted(progress);
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (started) {
      cancelAnimation(sweep);
      return;
    }
    sweep.set(0);
    sweep.set(
      withRepeat(
        withTiming(1, {
          duration: STARTING_SWEEP_MS,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        false
      )
    );
    return () => cancelAnimation(sweep);
  }, [started, sweep]);

  const startingStyle = useAnimatedStyle(() => ({
    left: `${-STARTING_SEGMENT_PERCENT + sweep.get() * (100 + STARTING_SEGMENT_PERCENT)}%`,
  }));

  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={
        started
          ? { min: 0, max: 100, now: Math.floor(progress * 100) }
          : { text: 'Starting' }
      }
    >
      {started ? (
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      ) : (
        <Animated.View
          style={[styles.fill, styles.startingSegment, startingStyle]}
          testID="download-progress-starting"
        />
      )}
    </View>
  );
};

export default DownloadProgressBar;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    track: {
      height: TRACK_HEIGHT,
      borderRadius: radius.full,
      overflow: 'hidden',
      backgroundColor: theme.bg.tile,
    },
    fill: {
      height: '100%',
      borderRadius: radius.full,
      backgroundColor: theme.bg.main,
    },
    startingSegment: {
      position: 'absolute',
      width: `${STARTING_SEGMENT_PERCENT}%`,
    },
  });
