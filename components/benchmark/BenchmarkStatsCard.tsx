import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Divider } from '../Divider';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';

const BenchmarkStatsCard = ({ data }: { data: any }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      <View style={styles.data}>
        <Text style={styles.label}>Total Time</Text>
        <Text style={styles.result}>
          {(data.totalTime / 1000).toFixed(2)} s
        </Text>
      </View>

      <Divider />

      <View style={styles.row}>
        <View style={styles.data}>
          <Text style={styles.label}>Time to First Token</Text>
          <Text style={styles.result}>
            {data.timeToFirstToken.toFixed(2)} ms
          </Text>
        </View>
        <View style={styles.data}>
          <Text style={styles.label}>Tokens Generated</Text>
          <Text style={styles.result}>{data.tokensGenerated.toFixed()}</Text>
        </View>
      </View>

      <Divider />

      <View style={styles.row}>
        <View style={styles.data}>
          <Text style={styles.label}>Tokens Per Second</Text>
          <Text style={styles.result}>{data.tokensPerSecond.toFixed(2)}</Text>
        </View>
        <View style={styles.data}>
          <Text style={styles.label}>Peak Memory</Text>
          <Text style={styles.result}>
            {Platform.OS === 'ios' ? `${data.peakMemory.toFixed(2)} GB` : 'N/A'}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default BenchmarkStatsCard;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: theme.border.soft,
      borderRadius: 4,
      padding: 16,
      gap: 16,
      flexDirection: 'column',
      backgroundColor: theme.bg.softPrimary,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 16,
    },
    data: {
      width: '50%',
      gap: 4,
    },
    label: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.defaultSecondary,
    },
    result: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      color: theme.text.primary,
    },
  });
