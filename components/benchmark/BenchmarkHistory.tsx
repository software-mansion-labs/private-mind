import React from 'react';
import { FlatList, View, StyleSheet, Text } from 'react-native';
import BenchmarkItem from './BenchmarkItem';
import { useModelStore } from '../../store/modelStore';
import { useTheme } from '../../context/ThemeContext';
import { BenchmarkResult } from '../../database/benchmarkRepository';
import BenchmarkIcon from '../../assets/icons/benchmark.svg';
import { fontSizes, fontFamily } from '../../styles/fontFamily';
import { BottomSheetModal } from '@gorhom/bottom-sheet';

interface Props {
  modalRef: React.RefObject<BottomSheetModal | null>;
  benchmarkList: BenchmarkResult[];
}

const BenchmarkHistory = ({ modalRef, benchmarkList }: Props) => {
  const { theme } = useTheme();
  const { getModelById } = useModelStore();

  return (
    <>
      <Text style={{ ...styles.label, color: theme.text.primary }}>
        Benchmark History
      </Text>
      <FlatList
        data={benchmarkList}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <BenchmarkItem
            entry={item}
            onPress={async () => {
              modalRef.current?.present({
                ...item,
                model: item.modelId
                  ? await getModelById(item.modelId)
                  : undefined,
              });
            }}
          />
        )}
        contentContainerStyle={{ gap: 8 }}
        ListEmptyComponent={
          <View
            style={{
              ...styles.noDataContainer,
              borderColor: theme.border.soft,
            }}
          >
            <BenchmarkIcon
              width={18}
              height={18}
              style={{ color: theme.text.defaultTertiary }}
            />
            <Text
              style={{
                ...styles.noDataText,
                color: theme.text.defaultTertiary,
              }}
            >
              There are no benchmarks to display yet
            </Text>
          </View>
        }
      />
    </>
  );
};

export default BenchmarkHistory;

const styles = StyleSheet.create({
  label: {
    fontSize: fontSizes.md,
    fontFamily: fontFamily.medium,
  },
  noDataContainer: {
    alignItems: 'center',
    gap: 8,
    padding: 24,
    borderWidth: 1,
    borderRadius: 4,
  },
  noDataText: {
    textAlign: 'center',
    fontFamily: fontFamily.regular,
    fontSize: fontSizes.sm,
  },
});
