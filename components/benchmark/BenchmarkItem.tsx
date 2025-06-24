import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BenchmarkResult } from '../../database/benchmarkRepository';
import BenchmarkIcon from '../../assets/icons/benchmark.svg';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontFamily';

interface Props {
  entry: BenchmarkResult;
  onPress: () => void;
}

const BenchmarkItem = ({ entry, onPress }: Props) => {
  const { theme } = useTheme();
  const date = new Date(entry.timestamp);
  const formattedDate = `${date.getDate()} ${date.toLocaleString('default', {
    month: 'short',
  })}`;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 9999,
          backgroundColor: theme.bg.softSecondary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <BenchmarkIcon
          width={15}
          height={15}
          style={{ color: theme.text.primary }}
        />
      </View>
      <View>
        <Text style={{ ...styles.title, color: theme.text.primary }}>
          {entry.modelName}
        </Text>
        <Text style={{ ...styles.date, color: theme.text.defaultSecondary }}>
          {formattedDate}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default BenchmarkItem;

const styles = StyleSheet.create({
  container: {
    borderRadius: 4,
    padding: 16,
    paddingLeft: 12,
    borderWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: { fontFamily: fontFamily.medium, fontSize: fontSizes.sm },
  date: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.regular,
  },
});
