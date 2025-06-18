import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useDefaultHeader } from '../hooks/useDefaultHeader';
import { useLLMStore } from '../store/llmStore';
import { useModelStore } from '../store/modelStore';
import { Model } from '../database/modelRepository';
import {
  BenchmarkResult,
  BenchmarkResultPerformanceNumbers,
  getAllBenchmarks,
  insertBenchmark,
} from '../database/benchmarkRepository';
import WithDrawerGesture from '../components/WithDrawerGesture';
import { ModelSelector } from '../components/benchmark/ModelSelector';
import PrimaryButton from '../components/PrimaryButton';
import { useTheme } from '../context/ThemeContext';
import BenchmarkResultSheet from '../components/bottomSheets/BenchmarkResultSheet';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useSQLiteContext } from 'expo-sqlite';
import { BenchmarkModal } from '../components/benchmark/BenchmarkModal';
import BenchmarkHistory from '../components/benchmark/BenchmarkHistory';

const calculateAverageBenchmark = (
  results: BenchmarkResultPerformanceNumbers[],
  iterations: number
) => {
  const averageResult = results.reduce((acc, curr) => {
    acc.totalTime += curr.totalTime;
    acc.timeToFirstToken += curr.timeToFirstToken;
    acc.tokensPerSecond += curr.tokensPerSecond;
    acc.tokensGenerated += curr.tokensGenerated;
    return acc;
  });
  averageResult.totalTime /= iterations;
  averageResult.timeToFirstToken /= iterations;
  averageResult.tokensPerSecond /= iterations;
  averageResult.tokensGenerated /= iterations;
  averageResult.peakMemory =
    Math.max(...results.map((r) => r.peakMemory)) / 1024 / 1024 / 1024;

  return averageResult;
};

const BenchmarkScreen = () => {
  useDefaultHeader();
  const isBenchmarkCancelled = useRef(false);
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { theme } = useTheme();
  const db = useSQLiteContext();
  const { runBenchmark, loadModel, interrupt } = useLLMStore();
  const { downloadedModels: models, getModelById } = useModelStore();

  const [selectedModel, setSelectedModel] = useState<Model | null>(models[0]);
  const [benchmarkList, setBenchmarkList] = useState<BenchmarkResult[]>([]);
  const [timer, setTimer] = useState(0);
  const [isBenchmarkModalVisible, setIsBenchmarkModalVisible] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const loadBenchmarks = useCallback(async () => {
    if (!db) return;
    const history = await getAllBenchmarks(db);
    setBenchmarkList(history);
  }, [db]);

  useEffect(() => {
    loadBenchmarks();
  }, [loadBenchmarks]);

  const runBenchmarks = async () => {
    if (!selectedModel) return;
    setIsBenchmarkModalVisible(true);

    const interval = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);
    const iterations = 1;
    await loadModel(selectedModel);

    const results: BenchmarkResultPerformanceNumbers[] = [];

    for (let i = 0; i < iterations; i++) {
      if (isBenchmarkCancelled.current) {
        clearInterval(interval);
        setTimer(0);
        setIsBenchmarkModalVisible(false);
        return;
      }
      const result = await runBenchmark(selectedModel!);
      if (result) {
        results.push(result);
      }
    }

    const averageResult = calculateAverageBenchmark(results, iterations);

    const benchmarkId = await insertBenchmark(db, {
      ...averageResult,
      modelId: selectedModel.id,
      modelName: selectedModel.modelName,
    });

    const newBenchmark: BenchmarkResult = {
      ...averageResult,
      id: benchmarkId,
      timestamp: '',
      modelId: selectedModel.id,
      modelName: selectedModel.modelName,
    };

    await loadBenchmarks();
    clearInterval(interval!);
    setShowSuccess(true);
    setTimer(0);
    setTimeout(() => {
      setIsBenchmarkModalVisible(false);
      setShowSuccess(false);
    }, 2000);
    bottomSheetModalRef.current?.present({
      ...newBenchmark,
      model: await getModelById(newBenchmark.modelId!),
    });
  };

  const handleCancel = () => {
    interrupt();
    isBenchmarkCancelled.current = true;
  };

  return (
    <>
      <WithDrawerGesture>
        <View
          style={{ ...styles.container, backgroundColor: theme.bg.softPrimary }}
        >
          <ModelSelector
            model={selectedModel}
            setSelectedModel={setSelectedModel}
          />
          <PrimaryButton
            disabled={!selectedModel}
            text="Run benchmark"
            onPress={runBenchmarks}
          />
          <BenchmarkHistory
            modalRef={bottomSheetModalRef}
            benchmarkList={benchmarkList}
          />
        </View>
      </WithDrawerGesture>
      <BenchmarkModal
        isVisible={isBenchmarkModalVisible}
        timer={timer}
        selectedModel={selectedModel!}
        showSuccess={showSuccess}
        handleCancel={handleCancel}
      />
      <BenchmarkResultSheet bottomSheetModalRef={bottomSheetModalRef} />
    </>
  );
};

export default BenchmarkScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
});
