import React from 'react';
import type { Message } from '../../database/chatRepository';
import type { Model } from '../../database/modelRepository';
import { pickMemoryStallFallback } from '../../constants/default-models';
import { useLLMStore } from '../../store/llmStore';
import { ModelState, useModelStore } from '../../store/modelStore';
import { useStableCallback } from '../../hooks/useStableCallback';
import MemoryStallCard from './MemoryStallCard';

interface UseMemoryStallCardOptions {
  chatId: number;
  model: Model | undefined;
  messageHistory: Message[];
  busy: boolean;
  answerWithModel: (model: Model) => void;
  retryWithChatModel: () => void;
}

const stalledQuestionHasImage = (messageHistory: Message[]): boolean =>
  !!messageHistory.findLast((message) => message.role === 'user')?.imagePath;

export const useMemoryStallCard = ({
  chatId,
  model,
  messageHistory,
  busy,
  answerWithModel,
  retryWithChatModel,
}: UseMemoryStallCardOptions): React.ReactNode => {
  const stalledHere = useLLMStore(
    (state) => model !== undefined && state.memoryStalls[chatId] === model.id
  );
  const didNotStart = useLLMStore(
    (state) => model !== undefined && state.failedToStartIn[chatId] === model.id
  );
  const isGenerating = useLLMStore((state) => state.isGenerating);
  const models = useModelStore((state) => state.models);
  const downloadStates = useModelStore((state) => state.downloadStates);
  const downloadModel = useModelStore((state) => state.downloadModel);

  const fallback =
    stalledHere && model
      ? pickMemoryStallFallback(
          model,
          models,
          stalledQuestionHasImage(messageHistory)
        )
      : undefined;

  const answerWithFallback = useStableCallback(() => {
    if (fallback) answerWithModel(fallback);
  });

  const downloadFallback = useStableCallback(() => {
    if (!fallback) return;
    downloadModel(fallback).catch((error) =>
      console.error('Failed to download the smaller model', error)
    );
  });

  if (!stalledHere || !model || isGenerating) return undefined;

  return (
    <MemoryStallCard
      stalledModelName={model.modelName}
      didNotStart={didNotStart}
      fallback={
        fallback && {
          modelName: fallback.modelName,
          isDownloaded: fallback.isDownloaded,
          isDownloading:
            downloadStates[fallback.id]?.status === ModelState.Downloading,
        }
      }
      disabled={busy}
      onAnswerWithFallback={answerWithFallback}
      onDownloadFallback={downloadFallback}
      onTryAgain={retryWithChatModel}
    />
  );
};
