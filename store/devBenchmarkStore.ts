import { create } from 'zustand';
import type { Regression } from '../utils/devBenchmark/report';
import type { BenchmarkRun } from '../utils/devBenchmark/types';

export type DevBenchmarkStatus = 'idle' | 'running' | 'stopping' | 'finished';

export type QueuedModelState =
  'waiting' | 'downloading' | 'ready' | 'testing' | 'tested' | 'skipped';

export interface QueuedModel {
  modelId: number;
  modelName: string;
  state: QueuedModelState;
}

interface DevBenchmarkStore {
  status: DevBenchmarkStatus;
  activity: string;
  run: BenchmarkRun | null;
  queue: QueuedModel[];
  regressions: Regression[];
  reportPath: string | null;
}

export const useDevBenchmarkStore = create<DevBenchmarkStore>(() => ({
  status: 'idle',
  activity: '',
  run: null,
  queue: [],
  regressions: [],
  reportPath: null,
}));
