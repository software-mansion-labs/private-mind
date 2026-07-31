import { estimatePromptTokens } from '../constants/context-window';
import {
  EMBEDDING_CHUNK_TOKEN_BUDGET,
  MIN_TEXT_SPLITTER_CHUNK_SIZE,
  TEXT_SPLITTER_CHUNK_SIZE,
} from '../constants/retrieval';
import {
  capChunksToTokenBudget,
  getChunkCharOverlap,
  getChunkCharSize,
  truncateToTokenBudget,
} from '../utils/textChunking';

const LATIN =
  'The quarterly report covers revenue, headcount and logistics across three plants. ';
const CHINESE =
  '泽菲里亚能源公司在波兰的三个城市设有生产基地，主要生产光伏组件和储能系统。';
const POLISH =
  'Dyrektorem finansowym spółki Zephyria jest Marta Kowalczyk-Nowak, powołana w marcu. ';

describe('getChunkCharSize', () => {
  it('keeps the full character size for Latin prose', () => {
    expect(getChunkCharSize(LATIN.repeat(20))).toBe(TEXT_SPLITTER_CHUNK_SIZE);
  });

  it('shrinks the size for Chinese, which costs ~4x the tokens per character', () => {
    const size = getChunkCharSize(CHINESE.repeat(20));

    expect(size).toBeLessThanOrEqual(EMBEDDING_CHUNK_TOKEN_BUDGET);
    expect(size).toBeGreaterThanOrEqual(MIN_TEXT_SPLITTER_CHUNK_SIZE);
  });

  it('lands between the two for a mixed-script document', () => {
    const mixed = `${LATIN.repeat(10)}${CHINESE.repeat(10)}`;
    const size = getChunkCharSize(mixed);

    expect(size).toBeGreaterThan(getChunkCharSize(CHINESE.repeat(20)));
    expect(size).toBeLessThan(TEXT_SPLITTER_CHUNK_SIZE);
  });

  it('never returns a size whose chunk would exceed the token budget', () => {
    for (const sample of [LATIN, POLISH, CHINESE, '🚀🚀🚀 ', 'абвгд ']) {
      const text = sample.repeat(60);
      const chunk = text.slice(0, getChunkCharSize(text));
      expect(estimatePromptTokens(chunk)).toBeLessThanOrEqual(
        EMBEDDING_CHUNK_TOKEN_BUDGET
      );
    }
  });

  it('falls back to the full size for empty text', () => {
    expect(getChunkCharSize('')).toBe(TEXT_SPLITTER_CHUNK_SIZE);
  });
});

describe('getChunkCharOverlap', () => {
  it('keeps the splitter overlap proportional to the chunk size', () => {
    expect(getChunkCharOverlap(TEXT_SPLITTER_CHUNK_SIZE)).toBe(200);
    expect(getChunkCharOverlap(250)).toBe(50);
  });
});

describe('capChunksToTokenBudget', () => {
  it('leaves chunks that already fit untouched', () => {
    const chunks = [LATIN, POLISH];
    expect(capChunksToTokenBudget(chunks)).toEqual(chunks);
  });

  it('splits a dense passage hiding inside an otherwise Latin document', () => {
    const oversized = CHINESE.repeat(30);

    const capped = capChunksToTokenBudget([LATIN, oversized]);

    expect(capped.length).toBeGreaterThan(2);
    for (const chunk of capped) {
      expect(estimatePromptTokens(chunk)).toBeLessThanOrEqual(
        EMBEDDING_CHUNK_TOKEN_BUDGET
      );
    }
  });

  it('preserves the text across the split', () => {
    const oversized = CHINESE.repeat(30);
    expect(capChunksToTokenBudget([oversized]).join('')).toBe(oversized);
  });

  it('does not drop a character that alone exceeds the budget', () => {
    expect(capChunksToTokenBudget(['字'], 0.5)).toEqual(['字']);
  });
});

describe('truncateToTokenBudget', () => {
  it('returns short text unchanged', () => {
    expect(truncateToTokenBudget('Kto jest dyrektorem finansowym?')).toBe(
      'Kto jest dyrektorem finansowym?'
    );
  });

  it('trims an over-long query to the budget', () => {
    const query = CHINESE.repeat(40);

    const truncated = truncateToTokenBudget(query);

    expect(truncated.length).toBeLessThan(query.length);
    expect(query.startsWith(truncated)).toBe(true);
    expect(estimatePromptTokens(truncated)).toBeLessThanOrEqual(
      EMBEDDING_CHUNK_TOKEN_BUDGET
    );
  });

  it('handles empty text', () => {
    expect(truncateToTokenBudget('')).toBe('');
  });
});
