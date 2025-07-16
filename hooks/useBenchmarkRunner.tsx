import { useState, useRef, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useLLMStore } from '../store/llmStore';
import { Model } from '../database/modelRepository';
import {
  insertBenchmark,
  BenchmarkResultPerformanceNumbers,
} from '../database/benchmarkRepository';

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

interface UseBenchmarkRunnerParams {
  onComplete: (newBenchmarkId: number) => void;
}

export function useBenchmarkRunner({ onComplete }: UseBenchmarkRunnerParams) {
  const db = useSQLiteContext();
  const { runBenchmark, loadModel, interrupt } = useLLMStore();

  const [isRunning, setIsRunning] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [timer, setTimer] = useState(0);
  const isCancelled = useRef(false);

  const startBenchmark = useCallback(
    async (selectedModel: Model | undefined) => {
      if (!selectedModel || isRunning) return;

      setIsRunning(true);
      setIsSuccess(false);
      setTimer(0);
      isCancelled.current = false;

      const timerInterval = setInterval(
        () => setTimer((prev) => prev + 1),
        1000
      );

      try {
        await loadModel(selectedModel, true);

        const iterations = 3;
        const results: BenchmarkResultPerformanceNumbers[] = [];

        for (let i = 0; i < iterations; i++) {
          if (isCancelled.current) break;
          const result = await runBenchmark();
          if (result) results.push(result);
        }

        if (isCancelled.current) return;

        const averageResult = calculateAverageBenchmark(results, iterations);
        const benchmarkId = await insertBenchmark(db, {
          ...averageResult,
          modelId: selectedModel.id,
          modelName: selectedModel.modelName,
        });

        setIsSuccess(true);
        onComplete(benchmarkId);

        setTimeout(() => setIsRunning(false), 1500);
      } catch (error) {
        console.error('Benchmark run failed:', error);
        setIsRunning(false);
      } finally {
        clearInterval(timerInterval);
      }
    },
    [db, runBenchmark, loadModel, onComplete, isRunning]
  );

  const cancelBenchmark = useCallback(() => {
    interrupt();
    isCancelled.current = true;
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
