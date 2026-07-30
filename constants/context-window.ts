import { type Model } from '../database/modelRepository';

const CHARS_PER_TOKEN = 3;

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

export const getPromptCharBudget = (model: Model): number => {
  const promptTokenBudget = Math.max(
    0,
    getContextWindowTokens(model) - GENERATION_RESERVE_TOKENS
  );
  return promptTokenBudget * CHARS_PER_TOKEN;
};
