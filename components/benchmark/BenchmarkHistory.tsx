import React, { useCallback } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useModelStore } from '../../store/modelStore';
import { BenchmarkResult } from '../../database/benchmarkRepository';
import { BenchmarkResultSheetData } from '../bottomSheets/BenchmarkResultSheet';
import BenchmarkItem from './BenchmarkItem';
import BenchmarkIcon from '../../assets/icons/benchmark.svg';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { FlatList } from 'react-native-gesture-handler';

interface Props {
  modalRef: React.RefObject<BottomSheetModal<BenchmarkResultSheetData> | null>;
  benchmarkList: BenchmarkResult[];
}

const BenchmarkHistory = ({ modalRef, benchmarkList }: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const getModelById = useModelStore((state) => state.getModelById);

  const renderItem = useCallback(
    ({ item }: { item: BenchmarkResult }) => (
      <BenchmarkItem
        entry={item}
        onPress={() => {
          const model = item.modelId ? getModelById(item.modelId) : undefined;
          modalRef.current?.present({ ...item, model });
        }}
      />
    ),
    [getModelById, modalRef]
  );

  return (
    <>
      <Text style={styles.label}>Benchmark History</Text>
      <FlatList
        data={benchmarkList}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.noDataContainer}>
            <BenchmarkIcon width={18} height={18} style={styles.noDataIcon} />
            <Text style={styles.noDataText}>
              There are no benchmarks to display yet
            </Text>
          </View>
        }
      />
    </>
  );
};

export default BenchmarkHistory;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    label: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
      paddingHorizontal: 16,
    },
    listContent: {
      gap: 8,
      paddingBottom: theme.insets.bottom + 16,
      paddingHorizontal: 16,
    },
    noDataContainer: {
      alignItems: 'center',
      gap: 8,
      padding: 24,
      borderWidth: 1,
      borderRadius: 12,
      borderColor: theme.border.soft,
    },
    noDataIcon: {
      color: theme.text.defaultTertiary,
    },
    noDataText: {
      textAlign: 'center',
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.defaultTertiary,
    },
  });
