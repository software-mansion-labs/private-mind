export const RECALL_SHARE_BY_WINDOW: readonly {
  minWindowTokens: number;
  share: number;
}[] = [
  { minWindowTokens: 8192, share: 0.3 },
  { minWindowTokens: 4096, share: 0.2 },
  { minWindowTokens: 0, share: 0.15 },
];

export const RECALL_MIN_KEPT_SHARE = 0.6;
export const RECALL_MAX_HITS = 6;
export const RECALL_MESSAGE_MAX_CHARS = 600;
export const RECALL_MIN_LEXICAL_SCORE = 0.2;
export const RECALL_MIN_SIMILARITY = 0.4;
export const RECALL_SPECIFIC_TERM_WEIGHT = 2;
export const RECALL_EMBED_PER_TURN_CAP = 24;
export const RECALL_EMBEDDING_CACHE_MAX = 512;
export const RECALL_BLOCK_HEADER =
  '\n\nEarlier in this conversation (recalled word for word, oldest first):\n';
