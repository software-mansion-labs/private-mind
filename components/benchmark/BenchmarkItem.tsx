import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BenchmarkResult } from '../../database/benchmarkRepository';
import BenchmarkIcon from '../../assets/icons/benchmark.svg';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes } from '../../styles/fontStyles';

interface Props {
  entry: BenchmarkResult;
  onPress: () => void;
}

const BenchmarkItem = ({ entry, onPress }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const date = new Date(entry.timestamp);
  const formattedDate = `${date.getDate()} ${date.toLocaleString('default', {
    month: 'short',
  })}`;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.iconWrapper}>
        <BenchmarkIcon width={15} height={15} style={styles.icon} />
      </View>
      <View>
        <Text style={styles.title}>{entry.modelName}</Text>
        <Text style={styles.date}>{formattedDate}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default BenchmarkItem;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      paddingLeft: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border.soft,
    },
    iconWrapper: {
      width: 36,
      height: 36,
      borderRadius: 9999,
      backgroundColor: theme.bg.softSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: {
      color: theme.text.defaultTertiary,
    },
    title: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      color: theme.text.primary,
    },
    date: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      color: theme.text.defaultSecondary,
    },
  });
