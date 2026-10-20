import React from 'react';
import type { Model } from '../../database/modelRepository';
import { useLLMStore } from '../../store/llmStore';
import MemoryStallCard from './MemoryStallCard';

interface UseMemoryStallCardOptions {
  chatId: number;
  model: Model | undefined;
  busy: boolean;
  startNewChat: () => void;
  retryWithChatModel: () => void;
}

export const useMemoryStallCard = ({
  chatId,
  model,
  busy,
  startNewChat,
  retryWithChatModel,
}: UseMemoryStallCardOptions): React.ReactNode => {
  const stalledHere = useLLMStore(
    (state) => model !== undefined && state.memoryStalls[chatId] === model.id
  );
  const didNotStart = useLLMStore(
    (state) => model !== undefined && state.failedToStartIn[chatId] === model.id
  );
  const isGenerating = useLLMStore((state) => state.isGenerating);

  if (!stalledHere || !model || isGenerating) return undefined;

  return (
    <MemoryStallCard
      stalledModelName={model.modelName}
      didNotStart={didNotStart}
      disabled={busy}
      onStartNewChat={startNewChat}
      onTryAgain={retryWithChatModel}
    />
  );
};
