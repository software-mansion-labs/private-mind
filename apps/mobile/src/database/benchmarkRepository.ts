import { SQLiteDatabase } from 'expo-sqlite';

export interface BenchmarkResultPerformanceNumbers {
  totalTime: number;
  timeToFirstToken: number;
  tokensGenerated: number;
  tokensPerSecond: number;
  peakMemory: number;
}

export interface BenchmarkResult extends BenchmarkResultPerformanceNumbers {
  id: number;
  timestamp: string;
  modelId?: number;
  modelName: string;
}

export const insertBenchmark = async (
  db: SQLiteDatabase,
  benchmark: Omit<BenchmarkResult, 'id' | 'timestamp'>
): Promise<number> => {
  const result = await db.runAsync(
    `INSERT INTO benchmarks (
      modelId,
      modelName,
      totalTime,
      timeToFirstToken,
      tokensGenerated,
      tokensPerSecond,
      peakMemory
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      benchmark.modelId!,
      benchmark.modelName,
      benchmark.totalTime,
      benchmark.timeToFirstToken,
      benchmark.tokensGenerated,
      benchmark.tokensPerSecond,
      benchmark.peakMemory,
    ]
  );

  return result.lastInsertRowId!;
};

export const getAllBenchmarks = async (
  db: SQLiteDatabase
): Promise<BenchmarkResult[]> => {
  const rows = await db.getAllAsync<BenchmarkResult>(
    `SELECT * FROM benchmarks ORDER BY id DESC`
  );

  return rows;
};

export const deleteBenchmark = async (
  db: SQLiteDatabase,
  id: number
): Promise<void> => {
  await db.runAsync(`DELETE FROM benchmarks WHERE id = ?`, [id]);
};

export const getBenchmarkById = async (
  db: SQLiteDatabase,
  id: number
): Promise<BenchmarkResult | null> => {
  const row = await db.getFirstAsync<BenchmarkResult>(
    `SELECT * FROM benchmarks WHERE id = ?`,
    [id]
  );

  return row || null;
};
