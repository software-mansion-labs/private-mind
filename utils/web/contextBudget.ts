import { getPromptCharBudget } from '../../constants/context-window';
import { WEB_SNIPPET_MAX_CHARS } from '../../constants/web';
import type { Model } from '../../database/modelRepository';

const PROMPT_OVERHEAD_CHARS = 1400;

export const webContextCharBudget = (
  model: Model | null | undefined,
  existingContext: string[]
): number | undefined => {
  if (!model) return undefined;
  const alreadyUsed = existingContext.reduce(
    (total, chunk) => total + chunk.length,
    0
  );
  return Math.max(
    WEB_SNIPPET_MAX_CHARS,
    getPromptCharBudget(model) - PROMPT_OVERHEAD_CHARS - alreadyUsed
  );
};
