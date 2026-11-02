import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { textStyles } from '../../constants/design-system';
import {
  formatDownloadPercent,
  hasDownloadStarted,
} from '../../utils/downloadProgress';
import SpinningCircle from '../SpinningCircle';

const PERCENT_MIN_WIDTH = 40;
const SPINNER_SIZE = 16;
const SPINNER_STROKE = 2;

interface Props {
  progress: number;
}

const DownloadPercent = ({ progress }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);

  if (!hasDownloadStarted(progress)) {
    return (
      <View
        style={styles.spinnerSlot}
        accessible
        accessibilityLabel="Starting download"
      >
        <SpinningCircle
          size={SPINNER_SIZE}
          strokeWidth={SPINNER_STROKE}
          trackColor={theme.bg.tile}
          arcColor={theme.bg.main}
          testID="download-percent-starting"
        />
      </View>
    );
  }

  return <Text style={styles.percent}>{formatDownloadPercent(progress)}</Text>;
};

export default DownloadPercent;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    percent: {
      minWidth: PERCENT_MIN_WIDTH,
      textAlign: 'right',
      ...textStyles.bodySecondaryMedium,
      fontVariant: ['tabular-nums'],
      color: theme.text.accent,
    },
    spinnerSlot: {
      alignSelf: 'flex-start',
      minWidth: PERCENT_MIN_WIDTH,
      height: textStyles.bodyPrimaryMedium.lineHeight,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
  });
