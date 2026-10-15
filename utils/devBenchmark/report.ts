import {
  mkdir,
  readDir,
  readFile,
  writeFile,
} from '@dr.pogodin/react-native-fs';
import { traceDirectory } from '../traceFile';
import {
  isCannedAnswer,
  loopGuardCutAnswer,
  specialTokensIn,
  worstVerdict,
} from './checks';
import { DEV_BENCHMARK_SCENARIOS } from './scenarios';
import type {
  BenchmarkRun,
  CheckId,
  FindingSeverity,
  ModelResult,
  RunStatus,
  ScenarioResult,
  TurnAttempt,
  TurnResult,
  Verdict,
} from './types';

export const REPORT_DIRECTORY = 'dev-benchmark';

export interface FailedTurnRecord {
  build: string;
  device: string;
  model: string;
  scenario: string;
  turn: number;
  check: CheckId;
  severity: FindingSeverity;
  expected: string;
  actual: string;
  alsoFound: CheckId[];
  question: string;
  raw: string;
  tidied: string;
  final: string;
  retries: TurnAttempt['retries'];
  guards: { loopCut: boolean; specialTokens: string[] };
  prompt: { systemChars: number; historyTurns: number; lastUser: string };
  timings: TurnAttempt['timings'];
  retriedOnce: boolean;
  passedOnRetry: boolean;
  canned: boolean;
}

export interface ModelIssue {
  model: string;
  severity: FindingSeverity;
  summary: string;
}

export type RegressionMetric =
  'loadMs' | 'ttftMs' | 'tokPerS' | 'turnMs' | 'peakMemoryBytes';

export interface Regression {
  model: string;
  where: string;
  metric: RegressionMetric;
  previous: number;
  current: number;
  change: number;
}

export const REGRESSION_THRESHOLDS: Record<RegressionMetric, number> = {
  loadMs: 0.3,
  ttftMs: 0.3,
  tokPerS: -0.2,
  turnMs: 0.3,
  peakMemoryBytes: 0.15,
};

const SYSTEM_AND_CURRENT_MESSAGES = 2;

const TURNS_PER_MODEL = DEV_BENCHMARK_SCENARIOS.reduce(
  (total, scenario) => total + scenario.turns.length,
  0
);

export const runStatusOf = (run: BenchmarkRun): RunStatus =>
  run.status ?? (run.finishedAt ? 'finished' : 'interrupted');

const isScenarioDone = (result: ScenarioResult): boolean => {
  if (result.error) return true;
  const definition = DEV_BENCHMARK_SCENARIOS.find(
    (scenario) => scenario.id === result.scenarioId
  );
  return !definition || result.turns.length >= definition.turns.length;
};

export const isModelTested = (model: ModelResult): boolean =>
  !model.skippedReason &&
  (!!model.loadError ||
    (model.scenarios.length >= DEV_BENCHMARK_SCENARIOS.length &&
      model.scenarios.every(isScenarioDone)));

const turnsDone = (model: ModelResult): number =>
  model.scenarios.reduce((total, scenario) => total + scenario.turns.length, 0);

export const closeRun = (
  run: BenchmarkRun,
  status: Exclude<RunStatus, 'running'>
): void => {
  run.status = status;
  if (status === 'finished') {
    run.finishedAt = new Date().toISOString();
    return;
  }
  delete run.finishedAt;
  for (const model of run.models) {
    if (!model.skippedReason && !isModelTested(model)) {
      model.verdict = worstVerdict([model.verdict, 'warn']);
    }
  }
};

const isUnfinishedVerdict = (verdict: Verdict): verdict is FindingSeverity =>
  verdict !== 'pass';

const failedTurnRecord = (
  run: BenchmarkRun,
  model: ModelResult,
  scenario: ScenarioResult,
  turn: TurnResult,
  severity: FindingSeverity
): FailedTurnRecord | null => {
  const [attempt, retry] = turn.attempts;
  const [headline, ...others] = attempt?.findings ?? [];
  if (!attempt || !headline) return null;
  return {
    build: `${run.appVersion} (${run.build})`,
    device: `${run.device.name} · ${run.device.platform} ${run.device.osVersion} · ${run.device.ramGB} GB`,
    model: model.modelName,
    scenario: scenario.title,
    turn: turn.index + 1,
    check: headline.check,
    severity,
    expected: headline.expected,
    actual: headline.actual,
    alsoFound: others.map((item) => item.check),
    question: turn.prompt,
    raw: attempt.raw,
    tidied: attempt.tidied,
    final: attempt.final,
    retries: attempt.retries,
    guards: {
      loopCut: loopGuardCutAnswer(attempt.raw, attempt.tidied),
      specialTokens: specialTokensIn(attempt.final),
    },
    prompt: {
      systemChars: attempt.systemChars,
      historyTurns: Math.max(
        0,
        attempt.promptMessages - SYSTEM_AND_CURRENT_MESSAGES
      ),
      lastUser: turn.prompt,
    },
    timings: attempt.timings,
    retriedOnce: !!retry,
    passedOnRetry: !!retry && severity === 'warn',
    canned: isCannedAnswer(attempt),
  };
};

export interface FailedTurn {
  record: FailedTurnRecord;
  turn: TurnResult;
}

export const failedTurns = (run: BenchmarkRun): FailedTurn[] =>
  run.models.flatMap((model) =>
    model.scenarios.flatMap((scenario) =>
      scenario.turns.flatMap((turn) => {
        if (!isUnfinishedVerdict(turn.verdict)) return [];
        const record = failedTurnRecord(
          run,
          model,
          scenario,
          turn,
          turn.verdict
        );
        return record ? [{ record, turn }] : [];
      })
    )
  );

export const failedTurnRecords = (run: BenchmarkRun): FailedTurnRecord[] =>
  failedTurns(run).map((item) => item.record);

export const modelIssues = (run: BenchmarkRun): ModelIssue[] =>
  run.models.flatMap((model): ModelIssue[] => {
    if (model.skippedReason) {
      return [
        {
          model: model.modelName,
          severity: 'warn',
          summary: `not tested: ${model.skippedReason}`,
        },
      ];
    }
    if (model.loadError) {
      return [
        {
          model: model.modelName,
          severity: 'fail',
          summary: `did not load: ${model.loadError}`,
        },
      ];
    }
    const errors = model.scenarios.flatMap((scenario): ModelIssue[] =>
      scenario.error
        ? [
            {
              model: model.modelName,
              severity: 'fail',
              summary: `${scenario.title} stopped: ${scenario.error}`,
            },
          ]
        : []
    );
    const unfinished =
      runStatusOf(run) !== 'running' &&
      runStatusOf(run) !== 'finished' &&
      !isModelTested(model)
        ? [
            {
              model: model.modelName,
              severity: 'warn' as const,
              summary: `not finished: ${turnsDone(model)} of ${TURNS_PER_MODEL} turns tested`,
            },
          ]
        : [];
    return [...errors, ...unfinished];
  });

export const failedTurnSentence = (record: FailedTurnRecord): string => {
  const retryNote = record.passedOnRetry ? ' (passed on retry)' : '';
  return `${record.model} · ${record.scenario} turn ${record.turn}: ${record.check}, expected ${record.expected}, got ${record.actual}${retryNote}.`;
};

const previousModelResult = (
  previousRuns: BenchmarkRun[],
  run: BenchmarkRun,
  modelName: string
): ModelResult | null => {
  const candidates = previousRuns
    .filter(
      (previous) =>
        previous.device.id === run.device.id &&
        previous.startedAt < run.startedAt
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  for (const previous of candidates) {
    const model = previous.models.find(
      (candidate) =>
        candidate.modelName === modelName && candidate.loadMs !== undefined
    );
    if (model) return model;
  }
  return null;
};

const regressionOf = (
  model: string,
  where: string,
  metric: RegressionMetric,
  previous: number | null | undefined,
  current: number | null | undefined
): Regression | null => {
  if (!previous || current === null || current === undefined) return null;
  const change = (current - previous) / previous;
  const threshold = REGRESSION_THRESHOLDS[metric];
  const regressed = threshold < 0 ? change < threshold : change > threshold;
  return regressed ? { model, where, metric, previous, current, change } : null;
};

const generatedAttempt = (turn: TurnResult | undefined): TurnAttempt | null => {
  const attempt = turn?.attempts[0];
  return attempt && !isCannedAnswer(attempt) ? attempt : null;
};

const turnRegressions = (
  model: string,
  scenario: ScenarioResult,
  previousScenario: ScenarioResult
): (Regression | null)[] =>
  scenario.turns.flatMap((turn) => {
    const now = generatedAttempt(turn)?.timings;
    const before = generatedAttempt(
      previousScenario.turns.find((candidate) => candidate.index === turn.index)
    )?.timings;
    if (!now || !before) return [];
    const where = `${scenario.title} turn ${turn.index + 1}`;
    return [
      regressionOf(model, where, 'ttftMs', before.ttftMs, now.ttftMs),
      regressionOf(model, where, 'tokPerS', before.tokPerS, now.tokPerS),
      regressionOf(model, where, 'turnMs', before.turnMs, now.turnMs),
    ];
  });

const modelRegressions = (
  current: ModelResult,
  previous: ModelResult
): Regression[] => {
  const name = current.modelName;
  const found: (Regression | null)[] = [
    regressionOf(name, 'load', 'loadMs', previous.loadMs, current.loadMs),
    regressionOf(
      name,
      'speed test',
      'tokPerS',
      previous.speed?.tokPerS,
      current.speed?.tokPerS
    ),
    regressionOf(
      name,
      'speed test',
      'ttftMs',
      previous.speed?.ttftMs,
      current.speed?.ttftMs
    ),
    regressionOf(
      name,
      'speed test',
      'peakMemoryBytes',
      previous.speed?.peakMemoryBytes,
      current.speed?.peakMemoryBytes
    ),
  ];
  for (const scenario of current.scenarios) {
    const before = previous.scenarios.find(
      (candidate) => candidate.scenarioId === scenario.scenarioId
    );
    if (before) found.push(...turnRegressions(name, scenario, before));
  }
  return found.filter((item): item is Regression => item !== null);
};

export const compareWithPreviousRuns = (
  run: BenchmarkRun,
  previousRuns: BenchmarkRun[]
): Regression[] =>
  run.models.flatMap((model) => {
    if (model.loadMs === undefined) return [];
    const previous = previousModelResult(previousRuns, run, model.modelName);
    return previous ? modelRegressions(model, previous) : [];
  });

const METRIC_LABELS: Record<RegressionMetric, string> = {
  loadMs: 'load time',
  ttftMs: 'time to first token',
  tokPerS: 'tokens per second',
  turnMs: 'turn time',
  peakMemoryBytes: 'peak memory',
};

const formatMetric = (metric: RegressionMetric, value: number): string => {
  switch (metric) {
    case 'tokPerS':
      return `${value.toFixed(1)} tok/s`;
    case 'peakMemoryBytes':
      return `${(value / 1024 ** 3).toFixed(2)} GB`;
    default:
      return `${Math.round(value)} ms`;
  }
};

export const regressionSentence = (regression: Regression): string => {
  const percent = Math.round(regression.change * 100);
  const signed = percent > 0 ? `+${percent}` : `${percent}`;
  return `${regression.model} · ${regression.where}: ${METRIC_LABELS[regression.metric]} ${formatMetric(regression.metric, regression.previous)} → ${formatMetric(regression.metric, regression.current)} (${signed} %).`;
};

const VERDICT_WORDS: Record<Verdict, string> = {
  pass: 'green',
  warn: 'yellow',
  fail: 'red',
};

export const passedTurnCount = (scenario: ScenarioResult): number =>
  scenario.turns.filter((turn) => turn.verdict === 'pass').length;

const scenarioCell = (scenario: ScenarioResult | undefined): string =>
  scenario
    ? `${VERDICT_WORDS[scenario.verdict]} ${passedTurnCount(scenario)}/${scenario.turns.length}`
    : '–';

const scenarioTitles = (run: BenchmarkRun): string[] => [
  ...new Set(
    run.models.flatMap((model) =>
      model.scenarios.map((scenario) => scenario.title)
    )
  ),
];

const summaryTable = (run: BenchmarkRun): string[] => {
  const titles = scenarioTitles(run);
  const header = ['Model', 'Result', 'Load', 'tok/s', ...titles];
  const rows = run.models.map((model) => [
    model.modelName,
    VERDICT_WORDS[model.verdict],
    model.loadMs === undefined ? '–' : `${(model.loadMs / 1000).toFixed(1)} s`,
    model.speed ? model.speed.tokPerS.toFixed(1) : '–',
    ...titles.map((title) =>
      scenarioCell(model.scenarios.find((item) => item.title === title))
    ),
  ]);
  return [header, header.map(() => '---'), ...rows].map(
    (cells) => `| ${cells.join(' | ')} |`
  );
};

export const copyForAiMarkdown = (
  run: BenchmarkRun,
  regressions: Regression[]
): string => {
  const records = failedTurnRecords(run);
  const issues = modelIssues(run);
  const lines = [
    `# Private Mind dev benchmark — ${run.appVersion} (${run.build})`,
    '',
    `${run.device.name}, ${run.device.platform} ${run.device.osVersion}, ${run.device.ramGB} GB RAM. Mode ${run.mode}, started ${run.startedAt}, status ${runStatusOf(run)}${run.finishedAt ? ` at ${run.finishedAt}` : ''}.`,
    '',
    ...summaryTable(run),
  ];
  if (issues.length > 0) {
    lines.push('', '## Models not tested or stopped', '');
    lines.push(
      ...issues.map(
        (issue) =>
          `- ${issue.model} (${VERDICT_WORDS[issue.severity]}): ${issue.summary}`
      )
    );
  }
  lines.push('', `## Failed turns (${records.length})`);
  for (const record of records) {
    lines.push(
      '',
      `### ${failedTurnSentence(record)}`,
      '',
      '```json',
      JSON.stringify(record, null, 2),
      '```'
    );
  }
  if (regressions.length > 0) {
    lines.push('', '## Slower than the previous run on this device', '');
    lines.push(...regressions.map((item) => `- ${regressionSentence(item)}`));
  }
  return `${lines.join('\n')}\n`;
};

export const reportFileName = (run: BenchmarkRun): string =>
  `${run.startedAt.replace(/[:.]/g, '-')}-${run.build}.json`;

export const reportDirectory = (): string => traceDirectory(REPORT_DIRECTORY);

const writeReport = (path: string, run: BenchmarkRun): Promise<void> =>
  writeFile(path, JSON.stringify(run, null, 2), 'utf8');

export const saveRunReport = async (run: BenchmarkRun): Promise<string> => {
  const directory = reportDirectory();
  await mkdir(directory);
  const path = `${directory}/${reportFileName(run)}`;
  await writeReport(path, run);
  return path;
};

export interface SavedReport {
  path: string;
  run: BenchmarkRun;
}

const readRun = async (path: string): Promise<BenchmarkRun | null> => {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as BenchmarkRun;
    return Array.isArray(parsed.models) && parsed.device ? parsed : null;
  } catch {
    return null;
  }
};

export const loadSavedReports = async (): Promise<SavedReport[]> => {
  try {
    const entries = await readDir(reportDirectory());
    const reports = await Promise.all(
      entries
        .filter((entry) => entry.name.endsWith('.json'))
        .map(async (entry) => ({
          path: entry.path,
          run: await readRun(entry.path),
        }))
    );
    return reports.filter(
      (report): report is SavedReport => report.run !== null
    );
  } catch {
    return [];
  }
};

export const loadSavedRuns = async (): Promise<BenchmarkRun[]> =>
  (await loadSavedReports()).map((report) => report.run);

const neverClosed = (run: BenchmarkRun): boolean =>
  run.status === 'running' || (run.status === undefined && !run.finishedAt);

export const closeAbandonedReports = async (): Promise<SavedReport[]> => {
  const reports = await loadSavedReports();
  for (const report of reports.filter((item) => neverClosed(item.run))) {
    closeRun(report.run, 'interrupted');
    try {
      await writeReport(report.path, report.run);
    } catch (error) {
      console.warn(`Dev benchmark report not closed ${String(error)}`);
    }
  }
  return reports;
};

export const resumableReport = (
  reports: SavedReport[],
  deviceId: string,
  build: string
): SavedReport | null => {
  const latest = reports
    .filter(
      ({ run }) =>
        run.mode === 'full' && run.device.id === deviceId && run.build === build
    )
    .sort((a, b) => b.run.startedAt.localeCompare(a.run.startedAt))[0];
  return latest && runStatusOf(latest.run) !== 'finished' ? latest : null;
};
