import { renderHook, act, waitFor } from '@testing-library/react-native';
import useBenchmarkRunner from '../hooks/useBenchmarkRunner';
import { useLLMStore } from '../store/llmStore';
import * as benchmarkRepository from '../database/benchmarkRepository';

jest.mock('../store/llmStore', () => ({ useLLMStore: jest.fn() }));
jest.mock('expo-sqlite', () => ({ useSQLiteContext: jest.fn(() => ({})) }));
jest.mock('../database/benchmarkRepository');

const mockUseLLMStore = useLLMStore as jest.Mock;
const mockInsertBenchmark = benchmarkRepository.insertBenchmark as jest.Mock;

const baseModel = {
  id: 1,
  modelName: 'Test LLM',
  source: 'remote' as const,
  isDownloaded: true,
  modelPath: '',
  tokenizerPath: '',
  tokenizerConfigPath: '',
  thinking: false,
  featured: false,
};

const perfResult = {
  totalTime: 3000,
  timeToFirstToken: 200,
  tokensPerSecond: 15,
  tokensGenerated: 45,
  peakMemory: 1024 * 1024 * 1024,
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});

  mockUseLLMStore.mockReturnValue({
    runBenchmark: jest.fn().mockResolvedValue(perfResult),
    loadModel: jest.fn().mockResolvedValue(undefined),
    interrupt: jest.fn(),
  });
  mockInsertBenchmark.mockResolvedValue(42);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// ─── initial state ────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useBenchmarkRunner({ onComplete: jest.fn() }));
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.timer).toBe(0);
  });
});

// ─── startBenchmark ───────────────────────────────────────────────────────────

describe('startBenchmark', () => {
  it('does nothing when no model is selected', async () => {
    const { result } = renderHook(() => useBenchmarkRunner({ onComplete: jest.fn() }));
    await act(async () => {
      await result.current.startBenchmark(undefined);
    });
    expect(result.current.isRunning).toBe(false);
  });

  it('sets isRunning=true during benchmark', async () => {
    let resolveRunBenchmark!: (v: any) => void;
    mockUseLLMStore.mockReturnValue({
      runBenchmark: jest.fn(() => new Promise((r) => { resolveRunBenchmark = r; })),
      loadModel: jest.fn().mockResolvedValue(undefined),
      interrupt: jest.fn(),
    });

    const { result } = renderHook(() => useBenchmarkRunner({ onComplete: jest.fn() }));

    // startBenchmark sets isRunning synchronously before any awaits
    act(() => { result.current.startBenchmark(baseModel); });

    expect(result.current.isRunning).toBe(true);

    // Resolve the hanging promise to avoid open handles
    await act(async () => {
      if (resolveRunBenchmark) resolveRunBenchmark(perfResult);
      jest.advanceTimersByTime(10000);
    });
  });

  it('calls loadModel with hardReload=true before running', async () => {
    const loadModel = jest.fn().mockResolvedValue(undefined);
    const runBenchmark = jest.fn().mockResolvedValue(perfResult);
    mockUseLLMStore.mockReturnValue({ loadModel, runBenchmark, interrupt: jest.fn() });

    const { result } = renderHook(() => useBenchmarkRunner({ onComplete: jest.fn() }));
    await act(async () => {
      await result.current.startBenchmark(baseModel);
      jest.runAllTimers();
    });

    expect(loadModel).toHaveBeenCalledWith(baseModel, true);
  });

  it('runs benchmark 3 times and averages results', async () => {
    const runBenchmark = jest.fn().mockResolvedValue(perfResult);
    mockUseLLMStore.mockReturnValue({
      runBenchmark,
      loadModel: jest.fn().mockResolvedValue(undefined),
      interrupt: jest.fn(),
    });

    const { result } = renderHook(() => useBenchmarkRunner({ onComplete: jest.fn() }));
    await act(async () => {
      await result.current.startBenchmark(baseModel);
      jest.runAllTimers();
    });

    expect(runBenchmark).toHaveBeenCalledTimes(3);
  });

  it('calls insertBenchmark and onComplete on success', async () => {
    const onComplete = jest.fn();
    mockInsertBenchmark.mockResolvedValue(99);

    const { result } = renderHook(() => useBenchmarkRunner({ onComplete }));
    await act(async () => {
      await result.current.startBenchmark(baseModel);
      jest.runAllTimers();
    });

    expect(mockInsertBenchmark).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith(99);
  });

  it('sets isSuccess=true after successful run', async () => {
    const { result } = renderHook(() => useBenchmarkRunner({ onComplete: jest.fn() }));
    await act(async () => {
      await result.current.startBenchmark(baseModel);
      jest.runAllTimers();
    });

    expect(result.current.isSuccess).toBe(true);
  });

  it('resets isRunning on error', async () => {
    mockUseLLMStore.mockReturnValue({
      runBenchmark: jest.fn().mockRejectedValue(new Error('crash')),
      loadModel: jest.fn().mockResolvedValue(undefined),
      interrupt: jest.fn(),
    });

    const { result } = renderHook(() => useBenchmarkRunner({ onComplete: jest.fn() }));
    await act(async () => {
      await result.current.startBenchmark(baseModel);
    });

    expect(result.current.isRunning).toBe(false);
  });

  it('increments timer every second while running', async () => {
    let resolveAll!: () => void;
    const waitForIt = new Promise<void>((r) => { resolveAll = r; });

    mockUseLLMStore.mockReturnValue({
      runBenchmark: jest.fn(() => waitForIt.then(() => perfResult)),
      loadModel: jest.fn().mockResolvedValue(undefined),
      interrupt: jest.fn(),
    });

    const { result } = renderHook(() => useBenchmarkRunner({ onComplete: jest.fn() }));

    act(() => { result.current.startBenchmark(baseModel); });
    act(() => { jest.advanceTimersByTime(3000); });

    expect(result.current.timer).toBeGreaterThanOrEqual(3);
    resolveAll();
  });
});

// ─── cancelBenchmark ─────────────────────────────────────────────────────────

describe('cancelBenchmark', () => {
  it('calls interrupt and sets isRunning=false', () => {
    const interrupt = jest.fn();
    mockUseLLMStore.mockReturnValue({
      runBenchmark: jest.fn(() => new Promise(() => {})),
      loadModel: jest.fn().mockResolvedValue(undefined),
      interrupt,
    });

    const { result } = renderHook(() => useBenchmarkRunner({ onComplete: jest.fn() }));

    act(() => { result.current.startBenchmark(baseModel); });
    act(() => { result.current.cancelBenchmark(); });

    expect(interrupt).toHaveBeenCalled();
    expect(result.current.isRunning).toBe(false);
  });

  it('stops further iterations after cancel', async () => {
    const runBenchmark = jest.fn().mockResolvedValue(perfResult);
    mockUseLLMStore.mockReturnValue({
      runBenchmark,
      loadModel: jest.fn().mockResolvedValue(undefined),
      interrupt: jest.fn(),
    });

    const { result } = renderHook(() => useBenchmarkRunner({ onComplete: jest.fn() }));

    // Start benchmark and cancel mid-way through first iteration
    let startPromise: Promise<void>;
    act(() => {
      startPromise = result.current.startBenchmark(baseModel) as any;
      result.current.cancelBenchmark();
    });

    await act(async () => { await startPromise; });

    // With cancel, should not complete all 3 iterations
    expect(runBenchmark.mock.calls.length).toBeLessThan(3);
  });
});
