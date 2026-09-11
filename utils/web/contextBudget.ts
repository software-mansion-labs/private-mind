import { getPromptCharBudget } from '../../constants/context-window';
import { WEB_SNIPPET_MAX_CHARS } from '../../constants/web';
import type { Model } from '../../database/modelRepository';

const ASSEMBLED_INSTRUCTION_CHARS = 3000;

export const webContextCharBudget = (
  model: Model | null | undefined,
  existingContext: string[],
  systemPrompt = '',
  densitySample?: string
): number | undefined => {
  if (!model) return undefined;
  const alreadyUsed = existingContext.reduce(
    (total, chunk) => total + chunk.length,
    0
  );
  const overhead =
    systemPrompt.length + ASSEMBLED_INSTRUCTION_CHARS + alreadyUsed;
  return Math.max(
    WEB_SNIPPET_MAX_CHARS,
    getPromptCharBudget(model, densitySample) - overhead
  );
};
