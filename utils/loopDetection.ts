const MIN_CLAUSE_CHARS = 12;
const CLAUSE_SPLIT = /(?<=[\n۔।॥，；。])|(?<=[,;.،؛])(?!\d)/u;
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

const tableCellBarrier = (start: number): string => `\u0000${start}`;

const ENDS_SENTENCE = /[.!?\n।॥۔؟。！？]\s*$/u;

const substantialClauses = (text: string): Clause[] => {
  const units: Clause[] = [];
  let cursor = 0;
  let opensSentence = true;
  for (const clause of text.split(CLAUSE_SPLIT)) {
    const start = cursor;
    cursor += clause.length;
    const norm = normalizeClause(clause);
    if (spansTableCells(clause)) {
      units.push({
        norm: tableCellBarrier(start),
        start,
        opensSentence: false,
      });
    } else if (norm.length >= MIN_CLAUSE_CHARS && ALPHANUMERIC.test(norm)) {
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

const GRAPHEME = /\P{M}\p{M}*(?:\u200D\P{M}\p{M}*)*/gu;
const WHITESPACE_GRAPHEME = /^\s/u;
const SENTENCE_END_GRAPHEME = /^[.!?\n।॥۔؟。！？]/u;
const TABLE_PIPE = '|';
const MAX_TANDEM_UNIT_GRAPHEMES = 48;
const MIN_TANDEM_REPEATS = 4;
const MIN_WORDY_RUN_GRAPHEMES = 32;
const MIN_SINGLE_LETTER_RUN_GRAPHEMES = 64;
const MIN_SYMBOL_RUN_GRAPHEMES = 256;

type Graphemes = { ids: number[]; starts: number[]; texts: string[] };

const SPACE_ID = 0;

const splitGraphemes = (text: string, from: number): Graphemes => {
  const idOf = new Map<string, number>();
  const graphemes: Graphemes = { ids: [], starts: [], texts: [] };
  for (const match of text.slice(from).matchAll(GRAPHEME)) {
    const grapheme = match[0];
    let id = WHITESPACE_GRAPHEME.test(grapheme) ? SPACE_ID : idOf.get(grapheme);
    if (id === undefined) {
      id = idOf.size + 1;
      idOf.set(grapheme, id);
    }
    graphemes.ids.push(id);
    graphemes.starts.push(from + match.index!);
    graphemes.texts.push(grapheme);
  }
  return graphemes;
};

const isPrimitiveUnit = (ids: number[], start: number, length: number) => {
  for (let shorter = 1; shorter < length; shorter++) {
    if (length % shorter !== 0) continue;
    let repeatsShorter = true;
    for (let k = shorter; k < length; k++) {
      if (ids[start + k] !== ids[start + k - shorter]) {
        repeatsShorter = false;
        break;
      }
    }
    if (repeatsShorter) return false;
  }
  return true;
};

const shortestLoopRun = (unit: number) =>
  Math.max(MIN_WORDY_RUN_GRAPHEMES, MIN_TANDEM_REPEATS * unit);

const minRunGraphemes = (g: Graphemes, start: number, length: number) => {
  const unit = g.texts.slice(start, start + length).join('');
  if (unit.includes(TABLE_PIPE) || !LETTER.test(unit)) {
    return MIN_SYMBOL_RUN_GRAPHEMES;
  }
  if (length === 1) return MIN_SINGLE_LETTER_RUN_GRAPHEMES;
  return shortestLoopRun(length);
};

const isSpace = (g: Graphemes, index: number) => g.ids[index] === SPACE_ID;

const followsSentenceEnd = (g: Graphemes, index: number): boolean => {
  let k = index - 1;
  while (k >= 0 && isSpace(g, k)) k--;
  return k >= 0 && SENTENCE_END_GRAPHEME.test(g.texts[k]!);
};

const secondCopyStart = (g: Graphemes, runStart: number, unit: number) => {
  let wordStart: number | null = null;
  for (let k = runStart + unit; k < runStart + 2 * unit; k++) {
    if (isSpace(g, k)) continue;
    if (followsSentenceEnd(g, k)) return k;
    if (isSpace(g, k - 1)) wordStart ??= k;
  }
  return wordStart ?? runStart + unit;
};

const findTandemUnitRun = (text: string, from: number): LoopSpan | null => {
  const g = splitGraphemes(text, from);
  const count = g.ids.length;
  let earliest: LoopSpan | null = null;
  for (let unit = 1; unit <= MAX_TANDEM_UNIT_GRAPHEMES; unit++) {
    const shortest = shortestLoopRun(unit);
    let matched = 0;
    let needed: number | null = null;
    for (let j = 0; j + unit < count; j++) {
      if (g.ids[j] !== g.ids[j + unit]) {
        matched = 0;
        needed = null;
        continue;
      }
      matched++;
      if (matched + unit < shortest) continue;
      const runStart = j - matched + 1;
      needed ??= isPrimitiveUnit(g.ids, runStart, unit)
        ? minRunGraphemes(g, runStart, unit)
        : Infinity;
      if (matched + unit < needed) continue;
      const span = {
        first: g.starts[runStart]!,
        repeat: g.starts[secondCopyStart(g, runStart, unit)]!,
      };
      if (earliest === null || span.repeat < earliest.repeat) earliest = span;
      break;
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

const loopSpans = (text: string, tandemFrom = 0): LoopSpan[] =>
  [
    ...findRepeatedClauseSpans(text),
    ...findRepeatedLineSpans(text),
    findRepeatedWordRun(text),
    findRepeatedPhraseRun(text),
    findTandemUnitRun(text, tandemFrom),
  ].filter((span): span is LoopSpan => span !== null);

export const isRepetitionFromTheStart = (text: string): boolean => {
  const earliest = earliestSpan(loopSpans(text));
  return earliest !== null && earliest.first === 0;
};

const MIN_RUNAWAY_TAIL_CHARS = 64;
const RUNAWAY_TANDEM_SCAN_CHARS = 2048;
const RUNAWAY_TAIL_PERIODS = 2;

const runsAway = (span: LoopSpan, textLength: number): boolean =>
  textLength - span.repeat >=
  Math.max(
    MIN_RUNAWAY_TAIL_CHARS,
    RUNAWAY_TAIL_PERIODS * (span.repeat - span.first)
  );

export const hasRunawayLoop = (text: string): boolean =>
  loopSpans(text, Math.max(0, text.length - RUNAWAY_TANDEM_SCAN_CHARS)).some(
    (span) => runsAway(span, text.length)
  );

export const truncateAtRepeatedClause = (text: string): string => {
  const spans = loopSpans(text);
  if (spans.length === 0) return text;
  const kept = text.slice(0, Math.min(...spans.map((s) => s.repeat))).trimEnd();
  if (kept.trim()) return kept;
  return text.trim() ? salvageFirstUnit(text) : kept;
};
