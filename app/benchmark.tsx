import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { View, StyleSheet } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useModelStore } from '../store/modelStore';
import { useTheme } from '../context/ThemeContext';
import { Theme } from '../styles/colors';
import {
  BenchmarkResult,
  deleteBenchmark,
  getAllBenchmarks,
  getBenchmarkById,
} from '../database/benchmarkRepository';
import { Model } from '../database/modelRepository';
import WithDrawerGesture from '../components/WithDrawerGesture';
import { ModelSelector } from '../components/benchmark/ModelSelector';
import PrimaryButton from '../components/PrimaryButton';
import { BenchmarkModal } from '../components/benchmark/BenchmarkModal';
import BenchmarkResultSheet from '../components/bottomSheets/BenchmarkResultSheet';
import BenchmarkHistory from '../components/benchmark/BenchmarkHistory';
import { useBenchmarkRunner } from '../hooks/useBenchmarkRunner';
import useDefaultHeader from '../hooks/useDefaultHeader';

const BenchmarkScreen = () => {
  useDefaultHeader();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const db = useSQLiteContext();
  const { getModelById } = useModelStore();

  const [selectedModel, setSelectedModel] = useState<Model | undefined>();
  const [benchmarkList, setBenchmarkList] = useState<BenchmarkResult[]>([]);

  const handleBenchmarkComplete = useCallback(
    async (newBenchmarkId: number) => {
      await loadBenchmarks();

      const newResult = await getBenchmarkById(db, newBenchmarkId);
      if (newResult) {
        bottomSheetModalRef.current?.present({
          ...newResult,
          model: await getModelById(newResult.modelId!),
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
      <WithDrawerGesture>
        <View style={styles.container}>
          <ModelSelector
            model={selectedModel}
            setSelectedModel={setSelectedModel}
          />
          <PrimaryButton
            disabled={!selectedModel || isRunning}
            text="Run benchmark"
            onPress={() => startBenchmark(selectedModel)}
          />
          <BenchmarkHistory
            modalRef={bottomSheetModalRef}
            benchmarkList={benchmarkList}
          />
        </View>
      </WithDrawerGesture>

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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
      gap: 16,
      backgroundColor: theme.bg.softPrimary,
    },
  });
