import { getPromptCharBudget } from '../../constants/context-window';
import { WEB_SNIPPET_MAX_CHARS } from '../../constants/web';
import type { Model } from '../../database/modelRepository';

const INSTRUCTION_HINT_MARGIN_CHARS = 1200;

export const webContextCharBudget = (
  model: Model | null | undefined,
  existingContext: string[],
  systemPrompt = ''
): number | undefined => {
  if (!model) return undefined;
  const alreadyUsed = existingContext.reduce(
    (total, chunk) => total + chunk.length,
    0
  );
  const overhead =
    systemPrompt.length + INSTRUCTION_HINT_MARGIN_CHARS + alreadyUsed;
  return Math.max(WEB_SNIPPET_MAX_CHARS, getPromptCharBudget(model) - overhead);
};
