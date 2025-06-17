import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Divider } from '../Divider';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import { useTheme } from '../../context/ThemeContext';

const BenchmarkStatsCard = ({ data }: { data: any }) => {
  const { theme } = useTheme();

  return (
    <View style={[styles.card, { borderColor: theme.border.soft }]}>
      <View style={styles.data}>
        <Text style={[styles.label, { color: theme.text.defaultSecondary }]}>
          Total Time
        </Text>
        <Text style={[styles.result, { color: theme.text.primary }]}>
          {(data.totalTime / 1000).toFixed(2)} s
        </Text>
      </View>
      <Divider />
      <View style={styles.row}>
        <View style={styles.data}>
          <Text style={[styles.label, { color: theme.text.defaultSecondary }]}>
            Time to First Token
          </Text>
          <Text style={[styles.result, { color: theme.text.primary }]}>
            {data.timeToFirstToken.toFixed(2)} ms
          </Text>
        </View>
        <View style={styles.data}>
          <Text style={[styles.label, { color: theme.text.defaultSecondary }]}>
            Tokens Generated
          </Text>
          <Text style={[styles.result, { color: theme.text.primary }]}>
            {data.tokensGenerated.toFixed()}
          </Text>
        </View>
      </View>
      <Divider />
      <View style={styles.row}>
        <View style={styles.data}>
          <Text style={[styles.label, { color: theme.text.defaultSecondary }]}>
            Tokens Per Second
          </Text>
          <Text style={[styles.result, { color: theme.text.primary }]}>
            {data.tokensPerSecond.toFixed(2)}
          </Text>
        </View>
        <View style={styles.data}>
          <Text style={[styles.label, { color: theme.text.defaultSecondary }]}>
            Peak Memory
          </Text>
          <Text style={[styles.result, { color: theme.text.primary }]}>
            {Platform.OS === 'ios' ? `${data.peakMemory.toFixed(2)} GB` : 'N/A'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 16,
    gap: 16,
    flexDirection: 'column',
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
  },
  result: {
    fontFamily: fontFamily.medium,
    fontSize: fontSizes.md,
  },
});

export default BenchmarkStatsCard;
