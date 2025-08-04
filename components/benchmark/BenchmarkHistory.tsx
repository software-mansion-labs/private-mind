import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useTheme } from '../../context/ThemeContext';
import { useModelStore } from '../../store/modelStore';
import { BenchmarkResult } from '../../database/benchmarkRepository';
import BenchmarkItem from './BenchmarkItem';
import BenchmarkIcon from '../../assets/icons/benchmark.svg';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { FlatList } from 'react-native-gesture-handler';

interface Props {
  modalRef: React.RefObject<BottomSheetModal | null>;
  benchmarkList: BenchmarkResult[];
}

const BenchmarkHistory = ({ modalRef, benchmarkList }: Props) => {
  const { theme } = useTheme();
  const { getModelById } = useModelStore();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <>
      <Text style={styles.label}>Benchmark History</Text>
      <FlatList
        data={benchmarkList}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <BenchmarkItem
            entry={item}
            onPress={async () => {
              const model = item.modelId
                ? await getModelById(item.modelId)
                : undefined;
              modalRef.current?.present({ ...item, model });
            }}
          />
        )}
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
    },
    listContent: {
      gap: 8,
      paddingBottom: theme.insets.bottom + 16,
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
