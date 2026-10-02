import { THINK_CLOSE, THINK_OPEN } from '../../constants/citations';
import { NO_ANSWER_FALLBACK } from '../../constants/no-answer-fallback';
import { normalizeLine } from '../loopDetection';
import {
  isDanglingListAnswer,
  isQuestionEchoAnswer,
  isWrongLanguageAnswer,
} from '../messageSources';
import { normalizeModelText } from '../normalizeModelText';
import { answerLanguageAnchor } from '../promptUtils';
import { detectQuestionLanguage } from '../questionLanguage';
import {
  mapOutsideThink,
  stripThinkBlocks,
  unclosedThinkText,
} from '../thinking';
import type {
  CheckFinding,
  CheckId,
  FindingSeverity,
  TurnObservation,
  Verdict,
} from './types';

export type TurnCheck = (observation: TurnObservation) => CheckFinding | null;

const finding = (
  check: CheckId,
  severity: FindingSeverity,
  expected: string,
  actual: string
): CheckFinding => ({ check, severity, expected, actual });

const visibleText = (text: string): string => stripThinkBlocks(text);

const excerpt = (text: string, limit = 120): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > limit ? `${flat.slice(0, limit)}…` : flat;
};

export const checkAnswered: TurnCheck = ({ final, generationError }) => {
  if (generationError) {
    return finding(
      'no-answer',
      'fail',
      'an answer',
      `generation error: ${generationError}`
    );
  }
  if (!visibleText(final)) {
    return finding('no-answer', 'fail', 'an answer', 'nothing visible');
  }
  return null;
};

export const checkTurnTime: TurnCheck = ({ timings, turnTimeoutMs }) =>
  timings.turnMs > turnTimeoutMs
    ? finding(
        'turn-timeout',
        'fail',
        `under ${Math.round(turnTimeoutMs / 1000)} s`,
        `${Math.round(timings.turnMs / 1000)} s`
      )
    : null;

export const loopGuardCutAnswer = (raw: string, tidied: string): boolean =>
  !!raw && tidied !== mapOutsideThink(raw, normalizeModelText);

export const checkLoopGuardCut: TurnCheck = ({ raw, tidied }) =>
  loopGuardCutAnswer(raw, tidied)
    ? finding(
        'loop-guard-cut',
        'fail',
        'the loop guard leaves a loop-free answer whole',
        `cut from ${raw.length} to ${tidied.length} characters`
      )
    : null;

const REPEAT_LIMIT = 3;
const MIN_REPEATED_UNIT_CHARS = 20;
const SENTENCE_BOUNDARY = /(?<=[.!?。！？।॥۔؟])\s+/u;
const HAS_WORD_CHARACTER = /[\p{L}\p{N}]/u;

const repeatableUnits = (text: string): string[] =>
  text
    .split('\n')
    .flatMap((line) => line.split(SENTENCE_BOUNDARY))
    .map(normalizeLine)
    .filter(
      (unit) =>
        unit.length >= MIN_REPEATED_UNIT_CHARS && HAS_WORD_CHARACTER.test(unit)
    );

export const mostRepeatedUnit = (
  text: string
): { unit: string; count: number } | null => {
  const counts = new Map<string, number>();
  for (const unit of repeatableUnits(text)) {
    counts.set(unit, (counts.get(unit) ?? 0) + 1);
  }
  let top: { unit: string; count: number } | null = null;
  for (const [unit, count] of counts) {
    if (!top || count > top.count) top = { unit, count };
  }
  return top;
};

export const checkLoop: TurnCheck = ({ final }) => {
  const top = mostRepeatedUnit(visibleText(final));
  if (!top || top.count < REPEAT_LIMIT) return null;
  return finding(
    'loop',
    'fail',
    `no line or sentence repeated ${REPEAT_LIMIT} times`,
    `"${excerpt(top.unit, 80)}" ×${top.count}`
  );
};

export const checkLanguage: TurnCheck = ({ final, turn }) => {
  const asked = detectQuestionLanguage(turn.prompt);
  const answered = detectQuestionLanguage(visibleText(final));
  if (!asked || !answered || !isWrongLanguageAnswer(final, turn.prompt)) {
    return null;
  }
  return finding(
    turn.greeting ? 'greeting-language' : 'wrong-language',
    turn.greeting ? 'warn' : 'fail',
    asked.name,
    answered.name
  );
};

const NO_ANSWER_FALLBACK_TEXTS = new Set(Object.values(NO_ANSWER_FALLBACK));

export const checkQuestionEcho: TurnCheck = ({ final, turn }) => {
  const visible = visibleText(final);
  if (NO_ANSWER_FALLBACK_TEXTS.has(visible)) {
    return finding(
      'question-echo',
      'fail',
      'an answer',
      `the no-answer fallback: "${visible}"`
    );
  }
  if (isQuestionEchoAnswer(final, turn.prompt)) {
    return finding(
      'question-echo',
      'fail',
      'an answer',
      `the question repeated: "${excerpt(visible)}"`
    );
  }
  return null;
};

const SPECIAL_TOKEN =
  /<\|[^\s|>]*\|?>?|<(?:end_of_turn|start_of_turn|eos|bos)>|<\/s>|\[\/?INST\]/g;

export const specialTokensIn = (text: string): string[] => [
  ...new Set(visibleText(text).match(SPECIAL_TOKEN) ?? []),
];

export const checkSpecialTokens: TurnCheck = ({ final }) => {
  const leaked = specialTokensIn(final);
  return leaked.length > 0
    ? finding(
        'special-tokens',
        'fail',
        'no special tokens in the answer',
        leaked.join(' ')
      )
    : null;
};

export const checkThinkingLeak: TurnCheck = ({ final }) => {
  const unclosed = unclosedThinkText(final).trim();
  return unclosed
    ? finding(
        'thinking-leak',
        'fail',
        'thinking closed before the answer',
        `thinking never closed: "${excerpt(unclosed)}"`
      )
    : null;
};

const STARTS_WITH_BLANK_LINE = /^[^\S\n]*\n/;

export const checkBlankLine: TurnCheck = ({ final }) => {
  const carriesThinking =
    final.includes(THINK_OPEN) || final.includes(THINK_CLOSE);
  if (carriesThinking || !STARTS_WITH_BLANK_LINE.test(final)) return null;
  return finding(
    'blank-line',
    'fail',
    'the answer starts with text',
    'the answer starts with a blank line'
  );
};

const TABLE_ROW_START = /^\s*\|/;
const TABLE_ROW_END = /\|\s*$/;
const STRUCTURAL_LINE = /^\s*(?:#{1,6}\s|[-*•]\s|\p{Nd}+[.)]\s|```|>)/u;
const ENDS_MID_SENTENCE = /[\p{L}\p{M},]$/u;

const cutOffReason = (visible: string): string | null => {
  if (isDanglingListAnswer(visible)) {
    return 'ends on a list introduction or a bare list marker';
  }
  const lastLine = visible.slice(visible.lastIndexOf('\n') + 1);
  if (TABLE_ROW_START.test(lastLine)) {
    return TABLE_ROW_END.test(lastLine) ? null : 'ends inside a table row';
  }
  if (STRUCTURAL_LINE.test(lastLine)) return null;
  return ENDS_MID_SENTENCE.test(lastLine.trimEnd())
    ? `ends mid-sentence: "…${lastLine.trim().slice(-60)}"`
    : null;
};

export const checkCutOff: TurnCheck = ({ final }) => {
  const visible = visibleText(final);
  if (!visible) return null;
  const reason = cutOffReason(visible);
  return reason
    ? finding('cut-off', 'fail', 'a finished answer', reason)
    : null;
};

const NUMBERED_ITEM = /^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*\p{Nd}+[.)]/u;
const BULLET_ITEM = /^\s*[-*•]\s+\S/;
const HEADING = /^\s*#{1,6}\s+\S/;

export const countListItems = (text: string): number => {
  const lines = visibleText(text).split('\n');
  const count = (pattern: RegExp) =>
    lines.filter((line) => pattern.test(line)).length;
  return Math.max(count(NUMBERED_ITEM), count(BULLET_ITEM), count(HEADING));
};

export const checkListLength: TurnCheck = ({ final, turn }) => {
  if (turn.expectListItems === undefined || !visibleText(final)) return null;
  const items = countListItems(final);
  return items < turn.expectListItems
    ? finding(
        'list-short',
        'fail',
        `${turn.expectListItems} list items`,
        `${items} list items`
      )
    : null;
};

const TABLE_SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/;

export const hasMarkdownTable = (text: string): boolean =>
  visibleText(text)
    .split('\n')
    .some((line) => TABLE_SEPARATOR.test(line));

export const checkTable: TurnCheck = ({ final, turn }) =>
  turn.expectTable && visibleText(final) && !hasMarkdownTable(final)
    ? finding('table-missing', 'warn', 'a markdown table', 'no table')
    : null;

const PROMPT_SUFFIXES = ['/no_think', '/think'];

const echoedInstructions = (visible: string, prompt: string): string[] => {
  const anchors = [
    answerLanguageAnchor(detectQuestionLanguage(prompt)).trim(),
    answerLanguageAnchor(null).trim(),
  ];
  return [...anchors, ...PROMPT_SUFFIXES].filter((instruction) =>
    visible.includes(instruction)
  );
};

export const checkInstructionEcho: TurnCheck = ({ final, turn }) => {
  const echoed = echoedInstructions(visibleText(final), turn.prompt);
  return echoed.length > 0
    ? finding(
        'instruction-echo',
        'warn',
        'no prompt instruction in the answer',
        echoed.join(' ')
      )
    : null;
};

export const checkGuardRetries: TurnCheck = ({ retries }) => {
  if (retries.length === 0) return null;
  const reasons = retries.map(
    (retry) => `${retry.reason} (${retry.accepted ? 'accepted' : 'rejected'})`
  );
  return finding('guard-retry', 'warn', 'no guard retry', reasons.join('; '));
};

const MAX_REALISTIC_TOKENS_PER_SECOND = 1000;

export const checkSpeed: TurnCheck = ({ timings, final, generationError }) => {
  const { tokPerS } = timings;
  if (tokPerS === null || generationError || !visibleText(final)) return null;
  const unreal = tokPerS <= 0 || tokPerS > MAX_REALISTIC_TOKENS_PER_SECOND;
  return unreal
    ? finding(
        'unreal-speed',
        'warn',
        `between 0 and ${MAX_REALISTIC_TOKENS_PER_SECOND} tok/s`,
        `${Math.round(tokPerS)} tok/s`
      )
    : null;
};

export const TURN_CHECKS: TurnCheck[] = [
  checkAnswered,
  checkTurnTime,
  checkLoopGuardCut,
  checkLoop,
  checkLanguage,
  checkQuestionEcho,
  checkSpecialTokens,
  checkThinkingLeak,
  checkBlankLine,
  checkCutOff,
  checkListLength,
  checkTable,
  checkInstructionEcho,
  checkGuardRetries,
  checkSpeed,
];

const SEVERITY_RANK: Record<FindingSeverity, number> = { fail: 0, warn: 1 };

export const runTurnChecks = (observation: TurnObservation): CheckFinding[] =>
  TURN_CHECKS.map((check) => check(observation))
    .filter((result): result is CheckFinding => result !== null)
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

export const verdictOf = (findings: CheckFinding[]): Verdict => {
  if (findings.some((item) => item.severity === 'fail')) return 'fail';
  if (findings.length > 0) return 'warn';
  return 'pass';
};

export const verdictAfterRetry = (
  first: Verdict,
  retried: Verdict | null
): Verdict => {
  if (first !== 'fail') return first;
  if (retried === null || retried === 'fail') return 'fail';
  return 'warn';
};

const VERDICT_RANK: Record<Verdict, number> = { pass: 0, warn: 1, fail: 2 };

export const worstVerdict = (verdicts: Verdict[]): Verdict =>
  verdicts.reduce<Verdict>(
    (worst, verdict) =>
      VERDICT_RANK[verdict] > VERDICT_RANK[worst] ? verdict : worst,
    'pass'
  );
