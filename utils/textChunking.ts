import {
  estimateCharTokens,
  estimatePromptTokens,
} from '../constants/context-window';
import {
  EMBEDDING_CHUNK_TOKEN_BUDGET,
  MIN_TEXT_SPLITTER_CHUNK_SIZE,
  TEXT_SPLITTER_CHUNK_OVERLAP,
  TEXT_SPLITTER_CHUNK_SIZE,
} from '../constants/retrieval';

const OVERLAP_RATIO = TEXT_SPLITTER_CHUNK_OVERLAP / TEXT_SPLITTER_CHUNK_SIZE;

export const getChunkCharSize = (text: string): number => {
  if (text.length === 0) return TEXT_SPLITTER_CHUNK_SIZE;

  const density = estimatePromptTokens(text) / text.length;
  const fitsBudget = Math.floor(EMBEDDING_CHUNK_TOKEN_BUDGET / density);

  return Math.max(
    MIN_TEXT_SPLITTER_CHUNK_SIZE,
    Math.min(TEXT_SPLITTER_CHUNK_SIZE, fitsBudget)
  );
};

export const getChunkCharOverlap = (chunkSize: number): number =>
  Math.round(chunkSize * OVERLAP_RATIO);

const splitByTokenBudget = (text: string, budget: number): string[] => {
  const pieces: string[] = [];
  let piece = '';
  let tokens = 0;

  for (const char of text) {
    const cost = estimateCharTokens(char);
    if (piece.length > 0 && tokens + cost > budget) {
      pieces.push(piece);
      piece = '';
      tokens = 0;
    }
    piece += char;
    tokens += cost;
  }

  if (piece.length > 0) pieces.push(piece);
  return pieces;
};

export const capChunksToTokenBudget = (
  chunks: string[],
  budget: number = EMBEDDING_CHUNK_TOKEN_BUDGET
): string[] =>
  chunks.flatMap((chunk) =>
    estimatePromptTokens(chunk) <= budget
      ? [chunk]
      : splitByTokenBudget(chunk, budget)
  );

export const truncateToTokenBudget = (
  text: string,
  budget: number = EMBEDDING_CHUNK_TOKEN_BUDGET
): string =>
  estimatePromptTokens(text) <= budget
    ? text
    : (splitByTokenBudget(text, budget)[0] ?? '');
