import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { space } from '../../constants/design-system';
import { formatTimeLeft, secondsLeft } from '../../utils/downloadEta';

interface Props {
  modelSize?: number;
  progress: number;
  rate?: number;
}

const DownloadProgressDetails = ({ modelSize, progress, rate }: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const remaining = secondsLeft(progress, rate);

  return (
    <View style={styles.detailsRow}>
      {modelSize ? (
        <Text style={styles.bytes} numberOfLines={1}>
          {(modelSize * progress).toFixed(2)} of {modelSize.toFixed(2)} GB
        </Text>
      ) : null}
      {remaining !== undefined && (
        <Text style={styles.timeLeft} testID="downloading-model-time-left">
          {formatTimeLeft(remaining)}
        </Text>
      )}
    </View>
  );
};

export default DownloadProgressDetails;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    detailsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      columnGap: space.two,
      minHeight: lineHeights.xs,
    },
    bytes: {
      flexShrink: 1,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      fontVariant: ['tabular-nums'],
      color: theme.text.defaultTertiary,
    },
    timeLeft: {
      flexShrink: 1,
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      fontVariant: ['tabular-nums'],
      color: theme.text.defaultSecondary,
    },
  });
