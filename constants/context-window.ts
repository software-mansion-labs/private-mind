import { type Model } from '../database/modelRepository';

const CHARS_PER_TOKEN = 3;

const DEFAULT_CONTEXT_WINDOW_TOKENS = 2048;

const GENERATION_RESERVE_TOKENS = 512;

const CONTEXT_WINDOW_TOKENS_BY_FAMILY: Record<string, number> = {};

export const getContextWindowTokens = (model: Model): number =>
  (model.family ? CONTEXT_WINDOW_TOKENS_BY_FAMILY[model.family] : undefined) ??
  DEFAULT_CONTEXT_WINDOW_TOKENS;

export const estimateTokens = (text: string): number =>
  Math.ceil(text.length / CHARS_PER_TOKEN);

export const getPromptCharBudget = (model: Model): number => {
  const promptTokenBudget = Math.max(
    0,
    getContextWindowTokens(model) - GENERATION_RESERVE_TOKENS
  );
  return promptTokenBudget * CHARS_PER_TOKEN;
};
