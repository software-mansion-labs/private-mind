import { useState, useRef, useCallback, useEffect } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import Toast from 'react-native-toast-message';
import { useLLMStore } from '../store/llmStore';
import { Model } from '../database/modelRepository';
import {
  insertBenchmark,
  BenchmarkResultPerformanceNumbers,
} from '../database/benchmarkRepository';
import { Feedback } from '../utils/Feedback';
import { memoryMetric } from '../modules/memory-probe';
import {
  BENCHMARK_ITERATIONS,
  BENCHMARK_WARMUP_RUNS,
} from '../constants/default-benchmark';

const calculateAverageBenchmark = (
  results: BenchmarkResultPerformanceNumbers[]
) => {
  const n = results.length;
  const sum = results.reduce(
    (acc, curr) => {
      acc.totalTime += curr.totalTime;
      acc.timeToFirstToken += curr.timeToFirstToken;
      acc.tokensGenerated += curr.tokensGenerated;
      acc.generationTime += Math.max(1, curr.totalTime - curr.timeToFirstToken);
      return acc;
    },
    {
      totalTime: 0,
      timeToFirstToken: 0,
      tokensGenerated: 0,
      generationTime: 0,
    }
  );

  return {
    totalTime: sum.totalTime / n,
    timeToFirstToken: sum.timeToFirstToken / n,
    tokensPerSecond: sum.tokensGenerated / (sum.generationTime / 1000),
    tokensGenerated: sum.tokensGenerated / n,
    peakMemory:
      Math.max(...results.map((r) => r.peakMemory)) / 1024 / 1024 / 1024,
  };
};

const showBenchmarkDidNotRun = (reason: string) =>
  Toast.show({
    type: 'defaultToast',
    text1: `The benchmark didn't run: ${reason}`,
  });

interface UseBenchmarkRunnerParams {
  onComplete: (newBenchmarkId: number) => void;
}

export default function useBenchmarkRunner({
  onComplete,
}: UseBenchmarkRunnerParams) {
  const db = useSQLiteContext();
  const runBenchmark = useLLMStore((state) => state.runBenchmark);
  const loadModel = useLLMStore((state) => state.loadModel);
  const interrupt = useLLMStore((state) => state.interrupt);

  const [isRunning, setIsRunning] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [timer, setTimer] = useState(0);
  const currentRun = useRef(0);

  useEffect(
    () => () => {
      currentRun.current += 1;
      if (useLLMStore.getState().isBenchmarking) interrupt();
    },
    [interrupt]
  );

  const startBenchmark = useCallback(
    async (selectedModel: Model | undefined) => {
      if (!selectedModel || isRunning) return;

      setIsRunning(true);
      setIsSuccess(false);
      setTimer(0);
      const run = ++currentRun.current;
      const isAbandoned = () => currentRun.current !== run;

      const timerInterval = setInterval(
        () => setTimer((prev) => prev + 1),
        1000
      );

      try {
        await loadModel(selectedModel, true);
        if (isAbandoned()) return;
        if (useLLMStore.getState().model?.id !== selectedModel.id) {
          setIsRunning(false);
          showBenchmarkDidNotRun(
            `${selectedModel.modelName} couldn't be loaded.`
          );
          return;
        }

        for (let i = 0; i < BENCHMARK_WARMUP_RUNS; i++) {
          if (isAbandoned()) break;
          await runBenchmark();
        }

        const results: BenchmarkResultPerformanceNumbers[] = [];

        for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
          if (isAbandoned()) break;
          const result = await runBenchmark();
          if (result) results.push(result);
        }

        if (isAbandoned()) return;
        if (results.length === 0) {
          setIsRunning(false);
          showBenchmarkDidNotRun(
            'the model returned no measurement. Try again.'
          );
          return;
        }

        const averageResult = calculateAverageBenchmark(results);
        const benchmarkId = await insertBenchmark(db, {
          ...averageResult,
          modelId: selectedModel.id,
          modelName: selectedModel.modelName,
          peakMemoryMetric: memoryMetric(),
        });

        setIsSuccess(true);
        Feedback.benchmarkComplete();
        onComplete(benchmarkId);

        setTimeout(() => setIsRunning(false), 1500);
      } catch (error) {
        console.error('Benchmark run failed:', error);
        if (isAbandoned()) return;
        setIsRunning(false);
      } finally {
        clearInterval(timerInterval);
      }
    },
    [db, runBenchmark, loadModel, onComplete, isRunning]
  );

  const cancelBenchmark = useCallback(() => {
    currentRun.current += 1;
    interrupt();
    setIsRunning(false);
  }, [interrupt]);

  return {
    isRunning,
    isSuccess,
    timer,
    startBenchmark,
    cancelBenchmark,
  };
}
