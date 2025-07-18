import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';

type Props = {
  timestamp: string;
};

const BenchmarkDateCard = ({ timestamp }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const displayDate = new Date(timestamp || new Date()).toLocaleDateString(
    'en-GB',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  );

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Benchmark date</Text>
      <Text style={styles.result}>{displayDate}</Text>
    </View>
  );
};

export default BenchmarkDateCard;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: theme.border.soft,
      borderRadius: 4,
      padding: 16,
      gap: 16,
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
