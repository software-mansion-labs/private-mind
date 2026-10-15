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

const storeHoldsAModel = () => useLLMStore.getState().model !== null;

export const beginLoadingPinnedModel = (model: Model): Promise<boolean> =>
  new Promise((resolve) => {
    if (storeHoldsAModel()) {
      resolve(true);
      return;
    }
    const unsubscribe = useLLMStore.subscribe((state) => {
      if (state.model === null) return;
      unsubscribe();
      resolve(true);
    });
    useLLMStore
      .getState()
      .loadModel(model)
      .catch((error) => {
        console.error(
          'Failed to start the model this chat is pinned to',
          error
        );
      })
      .finally(() => {
        unsubscribe();
        resolve(storeHoldsAModel());
      });
  });

export const retryWithPinnedModel = (
  model: Model | undefined,
  retryLastGeneration: () => Promise<void>
): Promise<void> => {
  loadModelPinnedToChat(model);
  return retryLastGeneration();
};
