const MIN_CLAUSE_CHARS = 12;
const CLAUSE_SPLIT = /(?<=[,;.\n])/;
const ALPHANUMERIC = /[\p{L}\p{N}]/u;
const TRAILING_PUNCTUATION = /[,;.!?]+$/;

const normalizeClause = (clause: string): string =>
  clause.trim().replace(TRAILING_PUNCTUATION, '').toLowerCase();

const MAX_CLAUSE_CYCLE = 6;
const CLAUSE_CYCLE_REPEATS = 2;

const findRepeatedClauseCut = (text: string): number | null => {
  const clauses = text.split(CLAUSE_SPLIT);
  const substantial: { norm: string; start: number }[] = [];
  let cursor = 0;

  for (const clause of clauses) {
    const start = cursor;
    cursor += clause.length;

    const norm = normalizeClause(clause);
    if (norm.length >= MIN_CLAUSE_CHARS && ALPHANUMERIC.test(norm)) {
      substantial.push({ norm, start });
    }
  }

  let earliestCut: number | null = null;
  for (let period = 1; period <= MAX_CLAUSE_CYCLE; period++) {
    const span = period * CLAUSE_CYCLE_REPEATS;
    for (let i = 0; i + span <= substantial.length; i++) {
      if (earliestCut !== null && substantial[i]!.start >= earliestCut) break;
      let cycles = true;
      for (let k = 0; k < period; k++) {
        if (substantial[i + k]!.norm !== substantial[i + period + k]!.norm) {
          cycles = false;
          break;
        }
      }
      if (cycles) {
        earliestCut = substantial[i]!.start;
        break;
      }
    }
  }

  return earliestCut;
};

const MIN_LINE_CHARS = 12;
const LIST_MARKER = /^\s*(?:\d+[.)]|[-*•])\s*/;

const findRepeatedLineCut = (text: string): number | null => {
  const lines = text.split('\n');
  let cursor = 0;
  let previousNorm: string | null = null;
  let previousStart = 0;

  for (const line of lines) {
    const start = cursor;
    cursor += line.length + 1;

    const norm = normalizeClause(line.replace(LIST_MARKER, ''));
    if (norm.length < MIN_LINE_CHARS || !ALPHANUMERIC.test(norm)) continue;

    if (norm === previousNorm) return previousStart;
    previousNorm = norm;
    previousStart = start;
  }

  return null;
};

const MIN_WORD_CHARS = 3;
const WORD_REPEAT_THRESHOLD = 4;
const WORD_SPLIT = /(\s+)/;
const ONLY_WHITESPACE = /^\s*$/;

const findRepeatedWordRun = (text: string): number | null => {
  let cursor = 0;
  let runStart = 0;
  let runWord: string | null = null;
  let runCount = 0;

  for (const token of text.split(WORD_SPLIT)) {
    if (!ONLY_WHITESPACE.test(token)) {
      const norm = normalizeClause(token);
      if (norm.length >= MIN_WORD_CHARS && ALPHANUMERIC.test(norm)) {
        if (norm === runWord) {
          runCount++;
          if (runCount >= WORD_REPEAT_THRESHOLD) return runStart;
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

const findRepeatedPhraseRun = (text: string): number | null => {
  const words: { norm: string; start: number }[] = [];
  let cursor = 0;
  for (const token of text.split(WORD_SPLIT)) {
    if (!ONLY_WHITESPACE.test(token)) {
      const norm = normalizeClause(token);
      if (norm.length > 0 && ALPHANUMERIC.test(norm)) {
        words.push({ norm, start: cursor });
      }
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

  let earliestCut: number | null = null;
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
        windowEquals(i, i + repeats * phraseLen, phraseLen)
      ) {
        repeats++;
      }
      if (repeats >= PHRASE_REPEAT_THRESHOLD) {
        const cut = words[i]!.start;
        if (earliestCut === null || cut < earliestCut) earliestCut = cut;
        i += repeats * phraseLen;
      } else {
        i++;
      }
    }
  }

  return earliestCut;
};

export const truncateAtRepeatedClause = (text: string): string => {
  const cuts = [
    findRepeatedClauseCut(text),
    findRepeatedLineCut(text),
    findRepeatedWordRun(text),
    findRepeatedPhraseRun(text),
  ].filter((cut): cut is number => cut !== null);
  if (cuts.length === 0) return text;
  return text.slice(0, Math.min(...cuts)).trimEnd();
};
