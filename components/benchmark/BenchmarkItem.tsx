import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BenchmarkResult } from '../../database/benchmarkRepository';
import { Model } from '../../database/modelRepository';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import { getModelFamily } from '../../utils/modelFamily';
import ModelFamilyTile from '../model-hub/ModelFamilyTile';
import ModelRow from '../model-hub/ModelRow';
import ModelRowText from '../model-hub/ModelRowText';
import { ROW_PADDING } from '../model-hub/RowGroup';
import { formatBenchmarkDate } from '../../utils/formatBenchmarkDate';
import ChevronRightIcon from '../../assets/icons/chevron-right.svg';

const CHEVRON_WIDTH = 7;
const CHEVRON_HEIGHT = 12;
const CHEVRON_OPACITY = 0.4;

interface Props {
  entry: BenchmarkResult;
  model?: Model;
  onPress: () => void;
}

const BenchmarkItem = ({ entry, model, onPress }: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const family = getModelFamily(model ?? { modelName: entry.modelName });

  return (
    <ModelRow
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${entry.modelName}, ${entry.tokensPerSecond.toFixed(1)} tokens per second`}
      testID="benchmark-history-row"
    >
      <ModelFamilyTile family={family} size="list" />
      <ModelRowText
        title={entry.modelName}
        subtitle={formatBenchmarkDate(entry.timestamp)}
        subtitleTone="tertiary"
      />
      <View style={styles.speed}>
        <Text style={styles.speedValue}>
          {entry.tokensPerSecond.toFixed(1)}
        </Text>
        <Text
          style={styles.speedUnit}
          maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
        >
          tokens/s
        </Text>
      </View>
      <ChevronRightIcon
        width={CHEVRON_WIDTH}
        height={CHEVRON_HEIGHT}
        style={styles.chevron}
      />
    </ModelRow>
  );
};

export default BenchmarkItem;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      padding: ROW_PADDING,
    },
    speed: {
      alignItems: 'flex-end',
    },
    speedValue: {
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      fontVariant: ['tabular-nums'],
      color: theme.text.primary,
    },
    speedUnit: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      color: theme.text.defaultTertiary,
    },
    chevron: {
      color: theme.text.primary,
      opacity: CHEVRON_OPACITY,
    },
  });
