import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import { useTheme } from '../../context/ThemeContext';

const BenchmarkDateCard = ({ timestamp }: { timestamp: string }) => {
  const { theme } = useTheme();
  const displayDate = new Date(timestamp || new Date()).toLocaleDateString(
    'en-GB',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  );

  return (
    <View style={[styles.card, { borderColor: theme.border.soft }]}>
      <Text style={[styles.label, { color: theme.text.defaultSecondary }]}>
        Benchmark date
      </Text>
      <Text style={[styles.result, { color: theme.text.primary }]}>
        {displayDate}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 16,
    gap: 16,
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

export default BenchmarkDateCard;
