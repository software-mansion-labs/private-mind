import type { Model } from '../../database/modelRepository';
import { useLLMStore } from '../../store/llmStore';

export const loadModelPinnedToChat = (model?: Model): void => {
  if (!model) return;

  const llm = useLLMStore.getState();
  if (llm.model?.id === model.id) return;

  llm.loadModel(model).catch((error) => {
    console.error('Failed to load the model this chat is pinned to', error);
  });
};

export const retryWithPinnedModel = (
  model: Model | undefined,
  retryLastGeneration: () => Promise<void>
): Promise<void> => {
  loadModelPinnedToChat(model);
  return retryLastGeneration();
};
