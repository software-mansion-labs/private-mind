import { useLLMStore } from '../store/llmStore';

export const useTurnInFlight = (): boolean =>
  useLLMStore(
    (state) =>
      (state.isGenerating || state.isProcessingPrompt) &&
      state.generatingForChatId !== null &&
      state.generatingForChatId === state.activeChatId
  );
