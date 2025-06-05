import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BenchmarkResult } from '../../database/benchmarkRepository';

const toFixed = (n: number, d = 2) => Number(n).toFixed(d);

const BenchmarkResultCard = ({ result }: { result: BenchmarkResult }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>🧪 Latest Result</Text>
    <Text style={styles.row}>
      Total Time:{' '}
      <Text style={styles.value}>{toFixed(result.totalTime / 1000)} s</Text>
    </Text>
    <Text style={styles.row}>
      TTFT:{' '}
      <Text style={styles.value}>
        {toFixed(result.timeToFirstToken / 1000)} s
      </Text>
    </Text>
    <Text style={styles.row}>
      Tokens: <Text style={styles.value}>{result.tokensGenerated}</Text>
    </Text>
    <Text style={styles.row}>
      TPS: <Text style={styles.value}>{toFixed(result.tokensPerSecond)}</Text>
    </Text>
    <Text style={styles.row}>
      Peak Mem:{' '}
      <Text style={styles.value}>{toFixed(result.peakMemory)} GB</Text>
    </Text>
  </View>
);

export default BenchmarkResultCard;

const styles = StyleSheet.create({
  card: {
    marginVertical: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardTitle: {
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 12,
  },
  row: {
    fontSize: 14,
    marginBottom: 6,
  },
  value: {
    fontWeight: 'bold',
  },
});
