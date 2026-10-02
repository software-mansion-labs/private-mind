import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  createChat,
  deleteMessagesAfter,
  getChatDigest,
  getChatMessages,
  getChatSettings,
  type ChatSettings,
} from '../../database/chatRepository';
import type { Model } from '../../database/modelRepository';
import { useChatStore } from '../../store/chatStore';
import {
  useDevBenchmarkStore,
  type QueuedModelState,
} from '../../store/devBenchmarkStore';
import { useLLMStore } from '../../store/llmStore';
import { useModelStore } from '../../store/modelStore';
import { listenToAnswerTraces, type AnswerTrace } from '../answerTrace';
import { getDeviceMemoryGB } from '../modelCompatibility';
import { isDeviceOnline } from '../network';
import {
  runTurnChecks,
  verdictAfterRetry,
  verdictOf,
  worstVerdict,
} from './checks';
import {
  benchmarkableModels,
  noRoomToDownload,
  smallestFirst,
} from './inventory';
import {
  compareWithPreviousRuns,
  loadSavedRuns,
  saveRunReport,
} from './report';
import { DEV_BENCHMARK_SCENARIOS } from './scenarios';
import type {
  BenchmarkMode,
  BenchmarkRun,
  DeviceSummary,
  ModelResult,
  Scenario,
  ScenarioResult,
  ScenarioTurn,
  TurnAttempt,
  TurnObservation,
  Verdict,
} from './types';

const KEEP_AWAKE_TAG = 'dev-benchmark';
const CHAT_TITLE_PREFIX = 'Dev benchmark';
const DIGEST_SETTLE_TIMEOUT_MS = 15_000;
const DIGEST_POLL_MS = 250;

let stopRequested = false;
let wakeModelQueue: (() => void) | null = null;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const elapsedSince = (startedAt: number): number =>
  Math.round(performance.now() - startedAt);

const describeDevice = (): DeviceSummary => ({
  id: DeviceInfo.getUniqueIdSync(),
  name: DeviceInfo.getModel(),
  platform: Platform.OS,
  osVersion: DeviceInfo.getSystemVersion(),
  ramGB: Math.round(getDeviceMemoryGB() * 10) / 10,
});

const setActivity = (activity: string) =>
  useDevBenchmarkStore.setState({ activity });

const setQueueState = (model: Model, state: QueuedModelState) =>
  useDevBenchmarkStore.setState((current) => ({
    queue: current.queue.map((entry) =>
      entry.modelId === model.id ? { ...entry, state } : entry
    ),
  }));

const snapshotOf = (run: BenchmarkRun): BenchmarkRun =>
  JSON.parse(JSON.stringify(run)) as BenchmarkRun;

const publish = async (run: BenchmarkRun): Promise<void> => {
  useDevBenchmarkStore.setState({ run: snapshotOf(run) });
  try {
    const reportPath = await saveRunReport(run);
    useDevBenchmarkStore.setState({ reportPath });
  } catch (error) {
    console.warn(`Dev benchmark report not saved ${String(error)}`);
  }
};

const NO_SOURCES = async () => ({ context: [] });

const newModelResult = (model: Model): ModelResult => ({
  modelId: model.id,
  modelName: model.modelName,
  modelSizeGB: model.modelSize ?? null,
  verdict: 'pass',
  scenarios: [],
});

const skipModel = async (
  run: BenchmarkRun,
  model: Model,
  reason: string
): Promise<void> => {
  run.models.push({
    ...newModelResult(model),
    verdict: 'warn',
    skippedReason: reason,
  });
  setQueueState(model, 'skipped');
  await publish(run);
};

const createModelQueue = (initial: Model[]) => {
  const waiting = [...initial].sort(smallestFirst);
  let closed = false;
  const wake = () => {
    wakeModelQueue?.();
    wakeModelQueue = null;
  };
  return {
    add: (model: Model) => {
      waiting.push(model);
      waiting.sort(smallestFirst);
      wake();
    },
    close: () => {
      closed = true;
      wake();
    },
    next: async (): Promise<Model | null> => {
      while (waiting.length === 0 && !closed && !stopRequested) {
        await new Promise<void>((resolve) => {
          wakeModelQueue = resolve;
        });
      }
      return stopRequested ? null : (waiting.shift() ?? null);
    },
  };
};

type ModelQueue = ReturnType<typeof createModelQueue>;

const downloadMissingModels = async (
  run: BenchmarkRun,
  missing: Model[],
  queue: ModelQueue
): Promise<void> => {
  const online = missing.length > 0 && (await isDeviceOnline());
  for (const model of missing) {
    if (stopRequested) break;
    if (!online) {
      await skipModel(run, model, 'not downloaded and the device is offline');
      continue;
    }
    const noRoom = noRoomToDownload(
      model,
      await DeviceInfo.getFreeDiskStorage()
    );
    if (noRoom) {
      await skipModel(run, model, noRoom);
      continue;
    }
    setQueueState(model, 'downloading');
    await useModelStore.getState().downloadModel(model);
    if (stopRequested) break;
    const downloaded = useModelStore
      .getState()
      .models.find((candidate) => candidate.id === model.id);
    if (downloaded?.isDownloaded) {
      setQueueState(model, 'ready');
      queue.add(downloaded);
    } else {
      await skipModel(run, model, 'the download failed');
    }
  }
  queue.close();
};

const waitForDigestUpdate = async (
  db: SQLiteDatabase,
  chatId: number,
  digestBefore: string | null
): Promise<void> => {
  const startedAt = performance.now();
  while (performance.now() - startedAt < DIGEST_SETTLE_TIMEOUT_MS) {
    if ((await getChatDigest(db, chatId)) !== digestBefore) return;
    await sleep(DIGEST_POLL_MS);
  }
};

const observeTurn = async (
  db: SQLiteDatabase,
  chatId: number,
  settings: ChatSettings,
  turn: ScenarioTurn,
  turnTimeoutMs: number
): Promise<TurnAttempt> => {
  const llm = useLLMStore.getState();
  await llm.setActiveChatId(chatId);
  const lastKeptId = (await getChatMessages(db, chatId)).at(-1)?.id ?? 0;
  const traces: AnswerTrace[] = [];
  const stopListening = listenToAnswerTraces((trace) => {
    if (trace.chatId === chatId) traces.push(trace);
  });
  const timeout = setTimeout(
    () => useLLMStore.getState().interrupt(),
    turnTimeoutMs
  );
  const startedAt = performance.now();
  let sendError: string | null = null;
  try {
    const accepted = await llm.sendChatMessage(
      turn.prompt,
      chatId,
      NO_SOURCES,
      settings
    );
    if (!accepted) sendError = 'the send was rejected';
  } catch (error) {
    sendError = String(error);
  } finally {
    clearTimeout(timeout);
    stopListening();
  }
  const turnMs = elapsedSince(startedAt);
  const storeError = useLLMStore.getState().generationError;
  const answer = (await getChatMessages(db, chatId)).find(
    (message) => message.id > lastKeptId && message.role === 'assistant'
  );
  const trace = traces.at(-1);
  const observed: Omit<TurnObservation, 'turn' | 'turnTimeoutMs'> = {
    raw: trace?.raw ?? '',
    tidied: trace?.tidied ?? '',
    final: trace?.final ?? '',
    retries: trace?.retries ?? [],
    generationError:
      sendError ?? (storeError?.chatId === chatId ? storeError.message : null),
    timings: {
      ttftMs: answer?.timeToFirstToken ?? null,
      tokPerS: answer?.tokensPerSecond ?? null,
      turnMs,
    },
  };
  return {
    ...observed,
    systemChars: trace?.systemPromptChars ?? 0,
    promptMessages: trace?.promptMessages ?? 0,
    findings: runTurnChecks({ ...observed, turn, turnTimeoutMs }),
  };
};

const lastMessageId = async (
  db: SQLiteDatabase,
  chatId: number
): Promise<number> => (await getChatMessages(db, chatId)).at(-1)?.id ?? 0;

const runScenario = async (
  db: SQLiteDatabase,
  run: BenchmarkRun,
  model: Model,
  scenario: Scenario,
  result: ScenarioResult
): Promise<void> => {
  const chatId = await createChat(
    db,
    `${CHAT_TITLE_PREFIX}: ${scenario.title}`,
    model.id,
    model.systemPrompt
  );
  if (!chatId) {
    result.error = 'the benchmark chat could not be created';
    result.verdict = 'fail';
    return;
  }
  let digestBeforeLastTurn: string | null = null;
  let lastTurnAnswered = false;
  try {
    const settings = await getChatSettings(db, chatId);
    for (const [index, turn] of scenario.turns.entries()) {
      if (stopRequested) break;
      setActivity(
        `${model.modelName} · ${scenario.title} · turn ${index + 1} of ${scenario.turns.length}`
      );
      const keptId = await lastMessageId(db, chatId);
      digestBeforeLastTurn = await getChatDigest(db, chatId);
      const first = await observeTurn(
        db,
        chatId,
        settings,
        turn,
        scenario.turnTimeoutMs
      );
      const attempts = [first];
      const firstVerdict = verdictOf(first.findings);
      let retriedVerdict: Verdict | null = null;
      if (firstVerdict === 'fail' && !stopRequested) {
        await deleteMessagesAfter(db, chatId, keptId);
        setActivity(
          `${model.modelName} · ${scenario.title} · retrying turn ${index + 1}`
        );
        const retry = await observeTurn(
          db,
          chatId,
          settings,
          turn,
          scenario.turnTimeoutMs
        );
        attempts.push(retry);
        retriedVerdict = verdictOf(retry.findings);
      }
      lastTurnAnswered = !!attempts.at(-1)?.final.trim();
      result.turns.push({
        index,
        prompt: turn.prompt,
        verdict: verdictAfterRetry(firstVerdict, retriedVerdict),
        attempts,
      });
      result.verdict = worstVerdict(result.turns.map((item) => item.verdict));
      await publish(run);
    }
  } catch (error) {
    result.error = String(error);
    result.verdict = 'fail';
  } finally {
    if (lastTurnAnswered) {
      await waitForDigestUpdate(db, chatId, digestBeforeLastTurn);
    }
    await useChatStore.getState().deleteChat(chatId);
  }
};

const benchmarkModel = async (
  db: SQLiteDatabase,
  run: BenchmarkRun,
  model: Model
): Promise<void> => {
  const result = newModelResult(model);
  run.models.push(result);
  setQueueState(model, 'testing');
  setActivity(`Loading ${model.modelName}`);
  await publish(run);

  const loadStartedAt = performance.now();
  await useLLMStore.getState().loadModel(model, true);
  const loadMs = elapsedSince(loadStartedAt);
  const llm = useLLMStore.getState();
  if (llm.model?.id !== model.id || llm.isLoading) {
    result.loadError = 'the model did not load';
    result.verdict = 'fail';
    setQueueState(model, 'tested');
    await publish(run);
    return;
  }
  result.loadMs = loadMs;

  setActivity(`${model.modelName} · speed test`);
  const speed = await llm.runBenchmark();
  result.speed = speed
    ? {
        tokPerS: speed.tokensPerSecond,
        ttftMs: speed.timeToFirstToken,
        peakMemoryBytes: speed.peakMemory,
      }
    : null;
  await publish(run);

  for (const scenario of DEV_BENCHMARK_SCENARIOS) {
    if (stopRequested) break;
    const scenarioResult: ScenarioResult = {
      scenarioId: scenario.id,
      title: scenario.title,
      verdict: 'pass',
      turns: [],
    };
    result.scenarios.push(scenarioResult);
    await runScenario(db, run, model, scenario, scenarioResult);
    result.verdict = worstVerdict(result.scenarios.map((item) => item.verdict));
    await publish(run);
  }
  setQueueState(model, 'tested');
};

const modelsToBenchmark = (mode: BenchmarkMode, quickModel?: Model): Model[] =>
  mode === 'quick' && quickModel
    ? [quickModel]
    : benchmarkableModels(useModelStore.getState().models);

const restoreUserState = async (
  model: Model | null,
  chatId: number | null
): Promise<void> => {
  const llm = useLLMStore.getState();
  if (model && llm.model?.id !== model.id) await llm.loadModel(model);
  await llm.setActiveChatId(chatId);
};

export const stopDevBenchmark = (): void => {
  if (useDevBenchmarkStore.getState().status !== 'running') return;
  stopRequested = true;
  useDevBenchmarkStore.setState({ status: 'stopping', activity: 'Stopping…' });
  useLLMStore.getState().interrupt();
  wakeModelQueue?.();
  wakeModelQueue = null;
};

export const runDevBenchmark = async ({
  db,
  mode,
  quickModel,
}: {
  db: SQLiteDatabase;
  mode: BenchmarkMode;
  quickModel?: Model;
}): Promise<void> => {
  if (useDevBenchmarkStore.getState().status === 'running') return;
  stopRequested = false;

  const candidates = modelsToBenchmark(mode, quickModel);
  const run: BenchmarkRun = {
    startedAt: new Date().toISOString(),
    appVersion: DeviceInfo.getVersion(),
    build: DeviceInfo.getBuildNumber(),
    mode,
    device: describeDevice(),
    models: [],
  };
  useDevBenchmarkStore.setState({
    status: 'running',
    activity: 'Preparing',
    run,
    regressions: [],
    reportPath: null,
    queue: candidates.map((model) => ({
      modelId: model.id,
      modelName: model.modelName,
      state: model.isDownloaded ? 'ready' : 'waiting',
    })),
  });

  const userModel = useLLMStore.getState().model;
  const userChatId = useLLMStore.getState().activeChatId;
  await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
  try {
    const previousRuns = await loadSavedRuns();
    const queue = createModelQueue(
      candidates.filter((model) => model.isDownloaded)
    );
    const downloads = downloadMissingModels(
      run,
      candidates.filter((model) => !model.isDownloaded),
      queue
    );
    for (
      let model = await queue.next();
      model !== null;
      model = await queue.next()
    ) {
      await benchmarkModel(db, run, model);
    }
    if (!stopRequested) await downloads;
    if (!stopRequested) run.finishedAt = new Date().toISOString();
    await publish(run);
    useDevBenchmarkStore.setState({
      regressions: compareWithPreviousRuns(run, previousRuns),
    });
  } catch (error) {
    console.error('Dev benchmark failed', error);
    await publish(run);
  } finally {
    deactivateKeepAwake(KEEP_AWAKE_TAG);
    setActivity('Restoring your model');
    await restoreUserState(userModel, userChatId).catch((error) =>
      console.warn(`Dev benchmark could not restore state ${String(error)}`)
    );
    useDevBenchmarkStore.setState({ status: 'finished', activity: '' });
  }
};
