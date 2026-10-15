const MIN_CLAUSE_CHARS = 12;
const CLAUSE_SPLIT = /(?<=[,;.\n،؛۔।॥，；。])/u;
const TABLE_CELL_SEPARATOR = /\|/g;
const ALPHANUMERIC = /[\p{L}\p{N}]/u;
const TRAILING_PUNCTUATION = /[,;.!?،؛۔؟।॥，；。！？]+$/u;

const normalizeClause = (clause: string): string =>
  clause.trim().replace(TRAILING_PUNCTUATION, '').toLowerCase();

const MAX_CLAUSE_CYCLE = 6;
const CLAUSE_CYCLE_REPEATS = 2;
const CLAUSE_REPEAT_LIMIT = 3;

type Unit = { norm: string; start: number };

type Clause = Unit & { opensSentence: boolean };

type LoopSpan = { first: number; repeat: number };

const earliestSpan = (spans: LoopSpan[]): LoopSpan | null =>
  spans.reduce<LoopSpan | null>(
    (best, span) => (best === null || span.first < best.first ? span : best),
    null
  );

const repeatedUnit = (units: Unit[], limit: number): LoopSpan | null => {
  const starts = new Map<string, number[]>();
  for (const { norm, start } of units) {
    const seen = starts.get(norm);
    if (seen) seen.push(start);
    else starts.set(norm, [start]);
  }
  let found: LoopSpan | null = null;
  for (const occurrences of starts.values()) {
    if (occurrences.length < limit) continue;
    const span = { first: occurrences[0]!, repeat: occurrences[1]! };
    if (found === null || span.repeat < found.repeat) found = span;
  }
  return found;
};

const spansTableCells = (clause: string): boolean => clause.includes('|');

const ENDS_SENTENCE = /[.!?\n।॥۔؟。！？]\s*$/u;

const substantialClauses = (text: string): Clause[] => {
  const units: Clause[] = [];
  let cursor = 0;
  let opensSentence = true;
  for (const clause of text.split(CLAUSE_SPLIT)) {
    const start = cursor;
    cursor += clause.length;
    const norm = normalizeClause(clause);
    if (
      norm.length >= MIN_CLAUSE_CHARS &&
      ALPHANUMERIC.test(norm) &&
      !spansTableCells(clause)
    ) {
      units.push({ norm, start, opensSentence });
    }
    opensSentence = ENDS_SENTENCE.test(clause);
  }
  return units;
};

const findClauseCycle = (units: Unit[]): LoopSpan | null => {
  for (let period = 1; period <= MAX_CLAUSE_CYCLE; period++) {
    const span = period * CLAUSE_CYCLE_REPEATS;
    for (let i = 0; i + span <= units.length; i++) {
      let cycles = true;
      for (let k = 0; k < period; k++) {
        if (units[i + k]!.norm !== units[i + period + k]!.norm) {
          cycles = false;
          break;
        }
      }
      if (cycles) {
        return { first: units[i]!.start, repeat: units[i + period]!.start };
      }
    }
  }
  return null;
};

const findRepeatedClauseSpans = (text: string): LoopSpan[] => {
  const clauses = substantialClauses(text);
  const sentenceOpeners = clauses.filter((clause) => clause.opensSentence);
  return [
    findClauseCycle(clauses),
    repeatedUnit(sentenceOpeners, CLAUSE_REPEAT_LIMIT),
  ].filter((span): span is LoopSpan => span !== null);
};

const MIN_LINE_CHARS = 12;
const LINE_REPEAT_LIMIT = 2;
const LIST_MARKER = /^\s*(?:\d+[.)]|[-*•])\s*/;

const findRepeatedLineSpans = (text: string): LoopSpan[] => {
  const units: Unit[] = [];
  let cursor = 0;
  let previousNorm: string | null = null;
  let previousStart = 0;
  let adjacent: LoopSpan | null = null;

  for (const line of text.split('\n')) {
    const start = cursor;
    cursor += line.length + 1;

    const norm = normalizeClause(line.replace(LIST_MARKER, ''));
    if (norm.length < MIN_LINE_CHARS || !ALPHANUMERIC.test(norm)) continue;

    units.push({ norm, start });
    if (adjacent === null && norm === previousNorm) {
      adjacent = { first: previousStart, repeat: start };
    }
    previousNorm = norm;
    previousStart = start;
  }

  return [adjacent, repeatedUnit(units, LINE_REPEAT_LIMIT)].filter(
    (span): span is LoopSpan => span !== null
  );
};

export const normalizeLine = (line: string): string =>
  normalizeClause(line.replace(LIST_MARKER, ''));

const MIN_WORD_CHARS = 3;
const WORD_REPEAT_THRESHOLD = 4;
const SHORT_WORD_REPEAT_THRESHOLD = 8;
const WORD_SPLIT = /(\s+)/;
const ONLY_WHITESPACE = /^\s*$/;
const LETTER = /\p{L}/u;

const runThresholdFor = (norm: string): number | null => {
  if (norm.length >= MIN_WORD_CHARS && ALPHANUMERIC.test(norm)) {
    return WORD_REPEAT_THRESHOLD;
  }
  return LETTER.test(norm) ? SHORT_WORD_REPEAT_THRESHOLD : null;
};

const findRepeatedWordRun = (text: string): LoopSpan | null => {
  let cursor = 0;
  let runStart = 0;
  let runSecond = 0;
  let runWord: string | null = null;
  let runCount = 0;

  for (const token of text.split(WORD_SPLIT)) {
    if (!ONLY_WHITESPACE.test(token)) {
      const norm = normalizeClause(token);
      const threshold = runThresholdFor(norm);
      if (threshold !== null) {
        if (norm === runWord) {
          runCount++;
          if (runCount === 2) runSecond = cursor;
          if (runCount >= threshold) {
            return { first: runStart, repeat: runSecond };
          }
        } else {
          runWord = norm;
          runCount = 1;
          runStart = cursor;
        }
      } else {
        runWord = null;
        runCount = 0;
      }
    }
    cursor += token.length;
  }

  return null;
};

const MAX_PHRASE_WORDS = 5;
const PHRASE_REPEAT_THRESHOLD = 3;
const MIN_PHRASE_CHARS = 8;

const findRepeatedPhraseRun = (text: string): LoopSpan | null => {
  const words: (Unit & { cell: number })[] = [];
  let cursor = 0;
  let cell = 0;
  for (const token of text.split(WORD_SPLIT)) {
    if (!ONLY_WHITESPACE.test(token)) {
      const norm = normalizeClause(token);
      if (norm.length > 0 && ALPHANUMERIC.test(norm)) {
        words.push({ norm, start: cursor, cell });
      }
      cell += token.match(TABLE_CELL_SEPARATOR)?.length ?? 0;
    }
    cursor += token.length;
  }

  const windowEquals = (a: number, b: number, len: number): boolean => {
    for (let k = 0; k < len; k++) {
      if (words[a + k]!.norm !== words[b + k]!.norm) return false;
    }
    return true;
  };
  const phraseChars = (start: number, len: number): number =>
    words.slice(start, start + len).reduce((sum, w) => sum + w.norm.length, 0);

  let earliest: LoopSpan | null = null;
  for (let phraseLen = 2; phraseLen <= MAX_PHRASE_WORDS; phraseLen++) {
    let i = 0;
    while (i + phraseLen * PHRASE_REPEAT_THRESHOLD <= words.length) {
      if (phraseChars(i, phraseLen) < MIN_PHRASE_CHARS) {
        i++;
        continue;
      }
      let repeats = 1;
      while (
        i + (repeats + 1) * phraseLen <= words.length &&
        words[i + (repeats + 1) * phraseLen - 1]!.cell === words[i]!.cell &&
        windowEquals(i, i + repeats * phraseLen, phraseLen)
      ) {
        repeats++;
      }
      if (repeats >= PHRASE_REPEAT_THRESHOLD) {
        const span = {
          first: words[i]!.start,
          repeat: words[i + phraseLen]!.start,
        };
        if (earliest === null || span.first < earliest.first) earliest = span;
        i += repeats * phraseLen;
      } else {
        i++;
      }
    }
  }

  return earliest;
};

const SALVAGE_UNIT = /[^.!?\n。！？।॥۔؟]+(?:[.!?\n。！？।॥۔؟]+|$)/;

const salvageFirstUnit = (text: string): string => {
  const sentence = text.trim().match(SALVAGE_UNIT)?.[0]?.trim();
  if (sentence) return sentence;
  return text.trim();
};

const loopSpans = (text: string): LoopSpan[] =>
  [
    ...findRepeatedClauseSpans(text),
    ...findRepeatedLineSpans(text),
    findRepeatedWordRun(text),
    findRepeatedPhraseRun(text),
  ].filter((span): span is LoopSpan => span !== null);

export const isRepetitionFromTheStart = (text: string): boolean => {
  const earliest = earliestSpan(loopSpans(text));
  return earliest !== null && earliest.first === 0;
};

export const truncateAtRepeatedClause = (text: string): string => {
  const spans = loopSpans(text);
  if (spans.length === 0) return text;
  const kept = text.slice(0, Math.min(...spans.map((s) => s.repeat))).trimEnd();
  if (kept.trim()) return kept;
  return text.trim() ? salvageFirstUnit(text) : kept;
};
