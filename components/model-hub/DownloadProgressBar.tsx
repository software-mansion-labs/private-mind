import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { radius } from '../../constants/design-system';

const TRACK_HEIGHT = 6;

interface Props {
  progress: number;
  accessibilityLabel: string;
}

const DownloadProgressBar = ({ progress, accessibilityLabel }: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.floor(progress * 100) }}
    >
      <View style={[styles.fill, { width: `${progress * 100}%` }]} />
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
  });
