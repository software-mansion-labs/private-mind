import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { BenchmarkResult } from '../../database/benchmarkRepository';
import { Model } from '../../database/modelRepository';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { pressedOpacity } from '../../styles/pressable';
import { space } from '../../constants/design-system';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import { getModelFamily } from '../../utils/modelFamily';
import ModelFamilyTile from '../model-hub/ModelFamilyTile';
import { ROW_PADDING } from '../model-hub/RowGroup';
import ChevronRightIcon from '../../assets/icons/chevron-right.svg';

const CHEVRON_WIDTH = 7;
const CHEVRON_HEIGHT = 12;
const CHEVRON_OPACITY = 0.4;

interface Props {
  entry: BenchmarkResult;
  model?: Model;
  onPress: () => void;
}

const formatBenchmarkDate = (timestamp: string) => {
  const date = new Date(timestamp);
  const day = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== new Date().getFullYear() && {
      year: 'numeric',
    }),
  });
  const time = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${day}, ${time}`;
};

const BenchmarkItem = ({ entry, model, onPress }: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const family = getModelFamily(model ?? { modelName: entry.modelName });

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && pressedOpacity]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${entry.modelName}, ${entry.tokensPerSecond.toFixed(1)} tokens per second`}
      testID="benchmark-history-row"
    >
      <ModelFamilyTile family={family} size="list" />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.modelName}
        </Text>
        <Text style={styles.date}>{formatBenchmarkDate(entry.timestamp)}</Text>
      </View>
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
    </Pressable>
  );
};

export default BenchmarkItem;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.three,
      padding: ROW_PADDING,
    },
    info: {
      flex: 1,
      minWidth: 0,
    },
    name: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      color: theme.text.primary,
    },
    date: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.defaultTertiary,
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
