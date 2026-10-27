import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';

const PERCENT_MIN_WIDTH = 40;

interface Props {
  progress: number;
}

const DownloadPercent = ({ progress }: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return <Text style={styles.percent}>{Math.floor(progress * 100)}%</Text>;
};

export default DownloadPercent;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    percent: {
      minWidth: PERCENT_MIN_WIDTH,
      textAlign: 'right',
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      fontVariant: ['tabular-nums'],
      color: theme.text.accent,
    },
  });
