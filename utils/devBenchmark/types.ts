import type { AnswerRetry } from '../answerTrace';

export type Verdict = 'pass' | 'warn' | 'fail';

export type FindingSeverity = Exclude<Verdict, 'pass'>;

export type CheckId =
  | 'no-answer'
  | 'turn-timeout'
  | 'loop-guard-cut'
  | 'loop'
  | 'wrong-language'
  | 'greeting-language'
  | 'question-echo'
  | 'special-tokens'
  | 'thinking-leak'
  | 'blank-line'
  | 'cut-off'
  | 'list-short'
  | 'table-missing'
  | 'instruction-echo'
  | 'guard-retry'
  | 'unreal-speed';

export interface CheckFinding {
  check: CheckId;
  severity: FindingSeverity;
  expected: string;
  actual: string;
}

export interface ScenarioTurn {
  prompt: string;
  language: string;
  greeting?: boolean;
  expectListItems?: number;
  expectTable?: boolean;
}

export interface Scenario {
  id: string;
  title: string;
  turnTimeoutMs: number;
  turns: ScenarioTurn[];
}

export interface TurnTimings {
  ttftMs: number | null;
  tokPerS: number | null;
  turnMs: number;
}

export interface TurnAttempt {
  raw: string;
  tidied: string;
  final: string;
  retries: AnswerRetry[];
  generationError: string | null;
  timings: TurnTimings;
  systemChars: number;
  promptMessages: number;
  findings: CheckFinding[];
}

export interface TurnObservation extends Omit<
  TurnAttempt,
  'findings' | 'systemChars' | 'promptMessages'
> {
  turn: ScenarioTurn;
  turnTimeoutMs: number;
}

export interface TurnResult {
  index: number;
  prompt: string;
  verdict: Verdict;
  attempts: TurnAttempt[];
}

export interface ScenarioResult {
  scenarioId: string;
  title: string;
  verdict: Verdict;
  turns: TurnResult[];
  error?: string;
}

export interface SpeedReading {
  tokPerS: number;
  ttftMs: number;
  peakMemoryBytes: number;
}

export interface ModelResult {
  modelId: number;
  modelName: string;
  modelSizeGB: number | null;
  verdict: Verdict;
  skippedReason?: string;
  loadMs?: number;
  loadError?: string;
  speed?: SpeedReading | null;
  scenarios: ScenarioResult[];
}

export interface DeviceSummary {
  id: string;
  name: string;
  platform: string;
  osVersion: string;
  ramGB: number;
}

export type BenchmarkMode = 'quick' | 'full';

export interface BenchmarkRun {
  startedAt: string;
  finishedAt?: string;
  appVersion: string;
  build: string;
  mode: BenchmarkMode;
  device: DeviceSummary;
  models: ModelResult[];
}
