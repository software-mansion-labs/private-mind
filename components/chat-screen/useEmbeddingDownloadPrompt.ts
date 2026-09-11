import { useCallback, useRef, useState } from 'react';
import {
  embeddingModelNeedsDownloadPrompt,
  useEmbeddingModelStore,
  whenEmbeddingStatusKnown,
} from '../../store/embeddingModelStore';
import {
  isHighMemoryDevice,
  isMemoryConstrained,
} from '../../utils/modelCompatibility';
import type { Model } from '../../database/modelRepository';
import type { DownloadResume } from '../../hooks/useAttachment';

export type EmbeddingSheetContext = 'document' | 'web';

interface Options {
  model: Model | undefined;
  webSearchEnabled?: boolean;
  onWebSearchToggle?: () => boolean | void;
  presentDownloadSheet: (resume?: DownloadResume) => void;
  markDownloadSheetClosed: () => void;
}

interface EmbeddingDownloadPrompt {
  embeddingSheetContext: EmbeddingSheetContext;
  embeddingSheetRequired: boolean;
  handleWebSearchToggle: () => void;
  handleEmbeddingSheetDismiss: () => void;
}

export const useEmbeddingDownloadPrompt = ({
  model,
  webSearchEnabled,
  onWebSearchToggle,
  presentDownloadSheet,
  markDownloadSheetClosed,
}: Options): EmbeddingDownloadPrompt => {
  const [embeddingSheetContext, setEmbeddingSheetContext] =
    useState<EmbeddingSheetContext>('document');
  const webEmbeddingPromptDismissedRef = useRef(false);
  const embeddingSheetRequiredRef = useRef(false);
  const webToggleSeqRef = useRef(0);

  const handleWebSearchToggle = useCallback(() => {
    const enabling = !webSearchEnabled;
    const toggleSeq = webToggleSeqRef.current + 1;
    webToggleSeqRef.current = toggleSeq;
    const accepted = onWebSearchToggle?.();
    if (!enabling || accepted === false) return;
    if (isMemoryConstrained(model)) return;

    const required = isHighMemoryDevice(model);
    if (!required && webEmbeddingPromptDismissedRef.current) return;

    whenEmbeddingStatusKnown().then((status) => {
      if (webToggleSeqRef.current !== toggleSeq) return;
      if (!embeddingModelNeedsDownloadPrompt(status)) return;
      setEmbeddingSheetContext('web');
      embeddingSheetRequiredRef.current = required;
      presentDownloadSheet('none');
    });
  }, [webSearchEnabled, onWebSearchToggle, model, presentDownloadSheet]);

  const handleEmbeddingSheetDismiss = useCallback(() => {
    if (embeddingSheetContext === 'web') {
      if (embeddingSheetRequiredRef.current) {
        if (useEmbeddingModelStore.getState().status !== 'ready') {
          onWebSearchToggle?.();
        }
      } else {
        webEmbeddingPromptDismissedRef.current = true;
      }
      setEmbeddingSheetContext('document');
      embeddingSheetRequiredRef.current = false;
    }
    markDownloadSheetClosed();
  }, [embeddingSheetContext, markDownloadSheetClosed, onWebSearchToggle]);

  return {
    embeddingSheetContext,
    embeddingSheetRequired:
      embeddingSheetContext === 'web' && embeddingSheetRequiredRef.current,
    handleWebSearchToggle,
    handleEmbeddingSheetDismiss,
  };
};
