import React, { useCallback } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useModelStore } from '../../store/modelStore';
import { scrollIndicatorProps } from '../../constants/scroll-indicator';
import { BenchmarkResult } from '../../database/benchmarkRepository';
import { BenchmarkResultSheetData } from '../bottomSheets/BenchmarkResultSheet';
import BenchmarkItem from './BenchmarkItem';
import BenchmarkIcon from '../../assets/icons/benchmark.svg';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { radius, space, stroke } from '../../constants/design-system';

interface Props {
  modalRef: React.RefObject<BottomSheetModal<BenchmarkResultSheetData> | null>;
  benchmarkList: BenchmarkResult[];
}

const RowSeparator = () => {
  const { styles } = useThemedStyles(createStyles);
  return <View style={styles.separator} />;
};

const BenchmarkHistory = ({ modalRef, benchmarkList }: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const getModelById = useModelStore((state) => state.getModelById);
  const lastIndex = benchmarkList.length - 1;

  const renderItem = useCallback(
    ({ item, index }: { item: BenchmarkResult; index: number }) => {
      const model = item.modelId ? getModelById(item.modelId) : undefined;
      return (
        <View
          style={[
            styles.groupRow,
            index === 0 && styles.groupFirst,
            index === lastIndex && styles.groupLast,
          ]}
        >
          <BenchmarkItem
            entry={item}
            model={model}
            onPress={() => modalRef.current?.present({ ...item, model })}
          />
        </View>
      );
    },
    [getModelById, modalRef, lastIndex, styles]
  );

  return (
    <FlatList
      data={benchmarkList}
      keyExtractor={(item) => item.id.toString()}
      contentContainerStyle={styles.listContent}
      {...scrollIndicatorProps()}
      renderItem={renderItem}
      ItemSeparatorComponent={RowSeparator}
      ListEmptyComponent={
        <View style={styles.noDataContainer}>
          <BenchmarkIcon width={18} height={18} style={styles.noDataIcon} />
          <Text style={styles.noDataText}>
            There are no benchmarks to display yet
          </Text>
        </View>
      }
    />
  );
};

export default BenchmarkHistory;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    listContent: {
      paddingBottom: theme.insets.bottom + space.four,
    },
    groupRow: {
      borderLeftWidth: stroke.soft,
      borderRightWidth: stroke.soft,
      borderColor: theme.border.soft,
      backgroundColor: theme.bg.softPrimary,
      overflow: 'hidden',
    },
    groupFirst: {
      borderTopWidth: stroke.soft,
      borderTopLeftRadius: radius.eighteen,
      borderTopRightRadius: radius.eighteen,
    },
    groupLast: {
      borderBottomWidth: stroke.soft,
      borderBottomLeftRadius: radius.eighteen,
      borderBottomRightRadius: radius.eighteen,
    },
    separator: {
      height: stroke.soft,
      backgroundColor: theme.border.soft,
    },
    noDataContainer: {
      alignItems: 'center',
      gap: space.two,
      padding: space.six,
      borderWidth: stroke.soft,
      borderRadius: radius.eighteen,
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
