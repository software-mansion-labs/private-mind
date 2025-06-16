import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, Modal } from 'react-native';
import { useDefaultHeader } from '../hooks/useDefaultHeader';
import { useLLMStore } from '../store/llmStore';
import { useModelStore } from '../store/modelStore';
import { Model } from '../database/modelRepository';
import {
  BenchmarkResult,
  getAllBenchmarks,
  insertBenchmark,
} from '../database/benchmarkRepository';
import BenchmarkItem from '../components/benchmark/BenchmarkItem';
import WithDrawerGesture from '../components/WithDrawerGesture';
import { ModelSelector } from '../components/benchmark/ModelSelector';
import PrimaryButton from '../components/PrimaryButton';
import { fontFamily, fontSizes } from '../styles/fontFamily';
import BenchmarkIcon from '../assets/icons/benchmark.svg';
import { useTheme } from '../context/ThemeContext';
import ModelCard from '../components/model-hub/ModelCard';
import SecondaryButton from '../components/SecondaryButton';
import CheckIcon from '../assets/icons/check.svg';
import { SpinningCircleTimer } from '../components/SpinningCircleTimer';
import BenchmarkResultSheet from '../components/bottomSheets/BenchmarkResultSheet';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useSQLiteContext } from 'expo-sqlite';

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

  const runBenchmarks = async () => {
    if (!selectedModel) return;
    setIsBenchmarkModalVisible(true);

    const interval = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);
    const iterations = 3;
    await loadModel(selectedModel);
    const results: Omit<BenchmarkResult, 'modelId' | 'id' | 'timestamp'>[] = [];
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

    const benchmarkId = await insertBenchmark(db, {
      ...averageResult,
      modelId: selectedModel.id,
    });

    const newBenchmark: BenchmarkResult = {
      ...averageResult,
      id: benchmarkId,
      timestamp: Date.now().toString(),
      modelId: selectedModel.id,
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
      model: await getModelById(newBenchmark.modelId),
    });
  };

  useEffect(() => {
    loadBenchmarks();
  }, [loadBenchmarks]);

  const handleCancel = () => {
    interrupt();
    isBenchmarkCancelled.current = true;
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
            disabled={!selectedModel}
            text="Run benchmark"
            onPress={runBenchmarks}
          />
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
                  bottomSheetModalRef.current?.present({
                    ...item,
                    model: await getModelById(item.modelId),
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
        </View>
      </WithDrawerGesture>

      <Modal
        visible={isBenchmarkModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancel}
      >
        <View style={styles.modalOverlay}>
          {!showSuccess ? (
            <View
              style={{
                ...styles.benchmarkCard,
                backgroundColor: theme.bg.softPrimary,
                height: 368,
              }}
            >
              <SpinningCircleTimer size={100} time={timer} />
              <View
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Text
                  style={{ ...styles.statusText, color: theme.text.primary }}
                >
                  Running a benchmark
                </Text>
                <Text
                  style={{
                    ...styles.subText,
                    color: theme.text.defaultTertiary,
                  }}
                >
                  It may take around 1–3 minutes…
                </Text>
              </View>
              <View style={{ width: '100%', gap: 8 }}>
                <ModelCard model={selectedModel!} onPress={() => {}} />
                <SecondaryButton
                  text={'Cancel benchmark'}
                  onPress={handleCancel}
                />
              </View>
            </View>
          ) : (
            <View
              style={{
                ...styles.benchmarkCard,
                backgroundColor: theme.bg.softPrimary,
                alignItems: 'center',
                justifyContent: 'center',
                height: 368,
              }}
            >
              <View
                style={{
                  ...styles.successIcon,
                  backgroundColor: theme.bg.softSecondary,
                }}
              >
                <CheckIcon width={48} height={48} />
              </View>
              <Text style={styles.statusText}>Your benchmark is ready!</Text>
            </View>
          )}
        </View>
      </Modal>
      <BenchmarkResultSheet bottomSheetModalRef={bottomSheetModalRef} />
    </>
  );
};

export default BenchmarkScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
    gap: 16,
  },
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
  benchmarkCard: {
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 24,
    width: '90%',
  },
  timerText: { fontFamily: fontFamily.medium, fontSize: fontSizes.xl },
  statusText: {
    fontSize: fontSizes.lg,
    fontFamily: fontFamily.medium,
  },
  subText: { fontSize: fontSizes.xs, fontFamily: fontFamily.regular },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#293775',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
  },
  successCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
