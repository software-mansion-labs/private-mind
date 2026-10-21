import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useModelStore } from '../../store/modelStore';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import {
  BenchmarkResult,
  deleteBenchmark,
  getAllBenchmarks,
  getBenchmarkById,
} from '../../database/benchmarkRepository';
import { Model } from '../../database/modelRepository';
import { ModelSelector } from '../../components/benchmark/ModelSelector';
import PrimaryButton from '../../components/PrimaryButton';
import { BenchmarkModal } from '../../components/benchmark/BenchmarkModal';
import BenchmarkResultSheet, {
  BenchmarkResultSheetData,
} from '../../components/bottomSheets/BenchmarkResultSheet';
import BenchmarkHistory from '../../components/benchmark/BenchmarkHistory';
import { SettingsSection } from '../../components/settings/SettingsSection';
import useBenchmarkRunner from '../../hooks/useBenchmarkRunner';
import useDefaultHeader from '../../hooks/useDefaultHeader';
import { space } from '../../constants/design-system';

const BenchmarkScreen = () => {
  useDefaultHeader({ glass: true });
  const headerHeight = useHeaderHeight();
  const bottomSheetModalRef =
    useRef<BottomSheetModal<BenchmarkResultSheetData>>(null);
  const { styles } = useThemedStyles(createStyles, headerHeight);
  const db = useSQLiteContext();
  const { getModelById } = useModelStore();
  const { modelId } = useLocalSearchParams<{ modelId?: string }>();

  const [selectedModel, setSelectedModel] = useState<Model | undefined>(() =>
    modelId ? getModelById(Number(modelId)) : undefined
  );
  const [benchmarkList, setBenchmarkList] = useState<BenchmarkResult[]>([]);

  const handleBenchmarkComplete = useCallback(
    async (newBenchmarkId: number) => {
      await loadBenchmarks();

      const newResult = await getBenchmarkById(db, newBenchmarkId);
      if (newResult) {
        bottomSheetModalRef.current?.present({
          ...newResult,
          model: getModelById(newResult.modelId!),
        });
      }
    },
    [db, getModelById]
  );

  const { isRunning, isSuccess, timer, startBenchmark, cancelBenchmark } =
    useBenchmarkRunner({ onComplete: handleBenchmarkComplete });

  const loadBenchmarks = useCallback(async () => {
    const history = await getAllBenchmarks(db);
    setBenchmarkList(history);
  }, [db]);

  useEffect(() => {
    loadBenchmarks();
  }, [loadBenchmarks]);

  const handleDelete = async (benchmarkId: number) => {
    await deleteBenchmark(db, benchmarkId);
    await loadBenchmarks();
  };

  return (
    <>
      <View style={styles.container}>
        <SettingsSection title="Model">
          <ModelSelector
            model={selectedModel}
            setSelectedModel={setSelectedModel}
          />
          <PrimaryButton
            disabled={!selectedModel || isRunning}
            text="Run benchmark"
            style={styles.runButton}
            onPress={() => startBenchmark(selectedModel)}
          />
        </SettingsSection>
        <SettingsSection title="History" fill>
          <BenchmarkHistory
            modalRef={bottomSheetModalRef}
            benchmarkList={benchmarkList}
          />
        </SettingsSection>
      </View>

      <BenchmarkModal
        isVisible={isRunning}
        timer={timer}
        selectedModel={selectedModel!}
        showSuccess={isSuccess}
        handleCancel={cancelBenchmark}
      />

      <BenchmarkResultSheet
        bottomSheetModalRef={bottomSheetModalRef}
        handleDelete={handleDelete}
      />
    </>
  );
};

export default BenchmarkScreen;

const createStyles = (theme: Theme, headerHeight: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      gap: space.six,
      paddingTop: headerHeight + space.six,
      paddingHorizontal: space.four,
      backgroundColor: theme.bg.softPrimary,
    },
    runButton: {
      marginTop: space.two,
    },
  });
