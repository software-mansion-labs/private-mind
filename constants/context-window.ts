import { type Model } from '../database/modelRepository';

const CHARS_PER_TOKEN = 3;
const CHARS_PER_TOKEN_DIACRITIC = 2.2;
const CHARS_PER_TOKEN_CJK = 1.5;
const SAMPLE_MAX_CHARS = 8000;
const DIACRITIC_MIN_RATIO = 0.02;
const CJK_MIN_RATIO = 0.2;

const DEFAULT_CONTEXT_WINDOW_TOKENS = 2048;

const GENERATION_RESERVE_TOKENS = 512;

// TODO: replace with each export's real window. Every family here is ≥32k
// upstream, but the ExecuTorch .pte bakes in a smaller one, so these are
// conservative floors. Unknown/imported models keep the 2048 default.
const CONTEXT_WINDOW_TOKENS_BY_FAMILY: Record<string, number> = {
  'Qwen 3': 4096,
  'Qwen 2.5': 4096,
  'LLaMA 3.2': 4096,
  'LFM 2.5': 4096,
  'Bielik': 4096,
  'Gemma 4': 4096,
};

export const getContextWindowTokens = (model: Model): number =>
  (model.family ? CONTEXT_WINDOW_TOKENS_BY_FAMILY[model.family] : undefined) ??
  DEFAULT_CONTEXT_WINDOW_TOKENS;

const charsPerToken = (sample?: string): number => {
  const slice = sample?.slice(0, SAMPLE_MAX_CHARS) ?? '';
  if (!slice) return CHARS_PER_TOKEN;
  const cjk =
    slice.match(/[\u3000-\u30ff\u3400-\u9fff\uac00-\ud7af]/g)?.length ?? 0;
  if (cjk / slice.length >= CJK_MIN_RATIO) return CHARS_PER_TOKEN_CJK;
  // eslint-disable-next-line no-control-regex
  const nonAscii = slice.match(/[^\x00-\x7f]/g)?.length ?? 0;
  return nonAscii / slice.length >= DIACRITIC_MIN_RATIO
    ? CHARS_PER_TOKEN_DIACRITIC
    : CHARS_PER_TOKEN;
};

export const getPromptCharBudget = (model: Model, sample?: string): number => {
  const promptTokenBudget = Math.max(
    0,
    getContextWindowTokens(model) - GENERATION_RESERVE_TOKENS
  );
  return Math.floor(promptTokenBudget * charsPerToken(sample));
};
