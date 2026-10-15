import { useLLMStore } from '../store/llmStore';
import {
  useWebSearchStore,
  WebSearchTraceEntry,
} from '../store/webSearchStore';
import { WEB_SEARCH_ENABLED } from '../constants/web';

const EMPTY_TRACE: WebSearchTraceEntry[] = [];

export const useWebSearchActivity = ({
  isLastMessage,
  content,
  hasWebResults,
}: {
  isLastMessage: boolean;
  content: string;
  hasWebResults: boolean;
}) => {
  const isGenerating = useLLMStore(
    (state) => isLastMessage && state.isGenerating
  );
  const isProcessingPrompt = useLLMStore(
    (state) => isLastMessage && state.isProcessingPrompt
  );
  const isRefining = useLLMStore((state) => isLastMessage && state.isRefining);
  const isModelLoading = useLLMStore(
    (state) => isLastMessage && state.isLoading
  );
  const isSearchingWeb = useWebSearchStore(
    (state) => isLastMessage && state.isSearchingWeb
  );
  const trace = useWebSearchStore((state) =>
    isLastMessage ? state.webSearchTrace : EMPTY_TRACE
  );

  const hasContent = !!content.trim();
  const isBusy = isLastMessage && (isGenerating || isProcessingPrompt);
  const isSearchingThis = isSearchingWeb && !hasContent;
  const webActive =
    WEB_SEARCH_ENABLED &&
    (hasWebResults || isSearchingThis || (isLastMessage && trace.length > 0));
  const isAwaitingFirstToken =
    !hasContent && isLastMessage && isProcessingPrompt;
  const isModelStarting = isAwaitingFirstToken && isModelLoading;

  return {
    isGenerating,
    isBusy,
    isRefining,
    isSearchingThis,
    isAwaitingFirstToken,
    isModelStarting,
    trace,
    webActive,
  };
};
