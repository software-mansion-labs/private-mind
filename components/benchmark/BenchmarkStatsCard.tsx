import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { radius, space, textStyles } from '../../constants/design-system';
import { BenchmarkResultPerformanceNumbers } from '../../database/benchmarkRepository';

const HERO_VALUE_SIZE = 26;
const HERO_VALUE_LINE_HEIGHT = 32;
const MS_PER_SECOND = 1000;

type StatSize = 'hero' | 'regular';

interface StatProps {
  label: string;
  value: string;
  caption: string;
  size: StatSize;
  highlighted?: boolean;
}

const Stat = ({
  label,
  value,
  caption,
  size,
  highlighted = false,
}: StatProps) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View
      style={[styles.stat, highlighted && styles.statHighlighted]}
      accessible
      accessibilityLabel={`${label}: ${value}, ${caption}`}
    >
      <Text style={[styles.label, highlighted && styles.textHighlighted]}>
        {label}
      </Text>
      <Text
        style={[
          size === 'hero' ? styles.heroValue : styles.value,
          highlighted && styles.textHighlighted,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={[styles.caption, highlighted && styles.textHighlighted]}>
        {caption}
      </Text>
    </View>
  );
};

interface Props {
  data: BenchmarkResultPerformanceNumbers;
  deviceMemory: string;
}

const BenchmarkStatsCard = ({ data, deviceMemory }: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        <Stat
          label="Speed"
          value={data.tokensPerSecond.toFixed(2)}
          caption="tokens per second"
          size="hero"
          highlighted
        />
        <Stat
          label="First token"
          value={`${data.timeToFirstToken.toFixed(2)} ms`}
          caption="time until it starts"
          size="hero"
        />
      </View>
      <View style={styles.row}>
        <Stat
          label="Total time"
          value={`${(data.totalTime / MS_PER_SECOND).toFixed(2)} s`}
          caption={`${data.tokensGenerated.toFixed()} tokens generated`}
          size="regular"
        />
        <Stat
          label="Peak memory"
          value={
            data.peakMemory > 0 ? `${data.peakMemory.toFixed(2)} GB` : 'N/A'
          }
          caption={deviceMemory ? `of ${deviceMemory} on device` : ''}
          size="regular"
        />
      </View>
    </View>
  );
};

export default BenchmarkStatsCard;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    grid: {
      gap: space.two,
    },
    row: {
      flexDirection: 'row',
      gap: space.two,
    },
    stat: {
      flex: 1,
      gap: space.half,
      padding: space.three,
      borderRadius: radius.twelve,
      backgroundColor: theme.bg.softTertiary,
    },
    statHighlighted: {
      backgroundColor: theme.bg.accentSoft,
    },
    textHighlighted: {
      color: theme.text.accent,
    },
    label: {
      ...textStyles.bodyTertiaryMedium,
      color: theme.text.defaultSecondary,
    },
    heroValue: {
      fontFamily: fontFamily.bold,
      fontSize: HERO_VALUE_SIZE,
      lineHeight: HERO_VALUE_LINE_HEIGHT,
      fontVariant: ['tabular-nums'],
      color: theme.text.primary,
    },
    value: {
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.xl,
      lineHeight: lineHeights.xl,
      fontVariant: ['tabular-nums'],
      color: theme.text.primary,
    },
    caption: {
      ...textStyles.bodyTertiaryRegular,
      color: theme.text.defaultTertiary,
    },
  });
