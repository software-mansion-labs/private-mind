import Toast from 'react-native-toast-message';
import type {
  Message,
  RetrievalStats,
  SourceDocument,
} from '../../../database/chatRepository';
import type { Model } from '../../../database/modelRepository';
import {
  isWebSearchReady,
  type ModelProfile,
} from '../../../constants/model-profiles';
import {
  RAG_PRIORITY_OVER_WEB_SEARCH,
  WEB_BENCH_LOGS,
  WEB_OFFLOAD_LLM_FOR_EMBEDDINGS,
  WEB_SEARCH_ENABLED,
  WEB_SEARCH_OVERALL_TIMEOUT_MS,
  WEB_SLOW_DEVICE_NOTE_MS,
} from '../../../constants/web';
import { WEB_SKIP_COPY, type WebSkipReason } from '../../../constants/web-copy';
import { useEmbeddingModelStore } from '../../../store/embeddingModelStore';
import { useLLMStore, type LLMStore } from '../../../store/llmStore';
import { useWebSearchStore } from '../../../store/webSearchStore';
import type { LFMEmbeddings } from '../../../utils/lfmEmbeddings';
import {
  hasMemoryForWebSearch,
  isMemoryConstrained,
} from '../../../utils/modelCompatibility';
import { isDeviceOnline } from '../../../utils/network';
import { webContextCharBudget } from '../../../utils/web/contextBudget';
import type { WebIntentKind } from '../../../utils/web/intentKind';
import { runWebSearch } from '../../../utils/web/runWebSearch';
import { webViewScrapeProvider } from '../../../utils/web/scrape/webViewScrapeProvider';
import { isStalledOnPlanning } from '../webSearchTrace';

const WEB_FAILED_COPY =
  'Couldn’t find anything useful online — answering without the web.';

export interface WebSourcesParams {
  webSearchEnabled: boolean;
  userInput: string;
  imagePath?: string;
  documentAttachedHere: boolean;
  answersFromDocument: boolean;
  history: Message[];
  readDigest: () => string | undefined;
  embeddings: LFMEmbeddings | null;
  modelProfile: ModelProfile;
  context: string[];
  systemPrompt: string;
  signal?: AbortSignal;
  runWithModelOffloaded: LLMStore['runWithModelOffloaded'];
}

export interface WebSources {
  context: string[];
  sourceDocuments: SourceDocument[];
  stats?: RetrievalStats['web'];
  webIntent?: string;
  webIntentKind?: WebIntentKind;
  webSubQueries?: string[];
  webWeak?: boolean;
  webSearchFailed?: boolean;
}

const webSkipReason = (
  skippedForDocuments: boolean,
  skippedForImage: boolean,
  model: Model | null
): WebSkipReason => {
  if (skippedForDocuments) return 'documents';
  if (skippedForImage) return 'image';
  if (hasMemoryForWebSearch(model)) return 'model';
  return 'memory';
};

const showToast = (text1: string) =>
  Toast.show({ type: 'defaultToast', text1 });

const noteSlowDeviceLater = () =>
  setTimeout(() => {
    const { isSearchingWeb, webSearchTrace, pushWebSearchEvent } =
      useWebSearchStore.getState();
    if (!isStalledOnPlanning(isSearchingWeb, webSearchTrace)) return;
    pushWebSearchEvent({ type: 'slow' });
  }, WEB_SLOW_DEVICE_NOTE_MS);

const searchWeb = async ({
  userInput,
  answersFromDocument,
  history,
  readDigest,
  embeddings,
  modelProfile,
  context,
  systemPrompt,
  signal,
  runWithModelOffloaded,
}: WebSourcesParams): Promise<WebSources> => {
  const trimmedInput = userInput.trim();
  const lowMemory = isMemoryConstrained(useLLMStore.getState().model);
  useWebSearchStore.getState().setSearchingWeb(true);
  const slowDeviceNoteTimer = noteSlowDeviceLater();
  const found: WebSources = { context: [], sourceDocuments: [] };
  try {
    const embeddingModelReady =
      !lowMemory && useEmbeddingModelStore.getState().status === 'ready';
    const searchStartedAt = Date.now();
    let isolateTotalMs = 0;
    const {
      context: webContext,
      sourceDocuments: webSources,
      telemetry,
    } = await runWebSearch({
      query: trimmedInput,
      history,
      digest: readDigest(),
      provider: webViewScrapeProvider,
      embeddings,
      embeddingModelReady,
      profile: modelProfile,
      contextOffset: context.length,
      contextCharBudget: webContextCharBudget(
        useLLMStore.getState().model,
        context,
        systemPrompt,
        trimmedInput
      ),
      signal,
      searchTimeoutMs: WEB_SEARCH_OVERALL_TIMEOUT_MS,
      lowMemory,
      useCache: true,
      isolateEmbeddings: WEB_OFFLOAD_LLM_FOR_EMBEDDINGS
        ? async (operation) => {
            const startedAt = Date.now();
            try {
              return await runWithModelOffloaded(operation, {
                restore: false,
              });
            } finally {
              isolateTotalMs += Date.now() - startedAt;
            }
          }
        : undefined,
      isOnline: isDeviceOnline,
      answersFromDocument,
      generate: (messages) => useLLMStore.getState().generateUtility(messages),
      onProgress: (event) =>
        useWebSearchStore.getState().pushWebSearchEvent(event),
    });
    const readCount = webSources.filter((source) => source.read).length;
    found.context = webContext;
    found.sourceDocuments = webSources;
    found.stats = {
      ms: Date.now() - searchStartedAt,
      sources: webSources.length,
      read: readCount,
      queries: telemetry.plannedQueries.length,
      ...(telemetry.timings ? { timings: telemetry.timings } : {}),
    };
    if (webSources.length > 0) {
      found.webIntent = telemetry.intent || undefined;
      found.webIntentKind = telemetry.intentKind;
      found.webSubQueries =
        telemetry.intentKind === 'comparison'
          ? telemetry.plannedQueries
          : undefined;
      found.webWeak = telemetry.finalLabel === 'incorrect';
    } else {
      found.webSearchFailed = telemetry.needsSearch && !telemetry.skippedReason;
    }
    if (WEB_BENCH_LOGS) {
      console.log(
        `[BENCH] offload=${WEB_OFFLOAD_LLM_FOR_EMBEDDINGS} search=${
          Date.now() - searchStartedAt
        }ms isolate=${isolateTotalMs}ms sources=${webSources.length} read=${readCount}`
      );
    }
  } catch (error) {
    console.warn('Web search failed', error);
    found.webSearchFailed = true;
  } finally {
    clearTimeout(slowDeviceNoteTimer);
    useWebSearchStore.getState().setSearchingWeb(false);
    webViewScrapeProvider.releaseHost();
  }
  if (found.webSearchFailed && !signal?.aborted) showToast(WEB_FAILED_COPY);
  return found;
};

export const gatherWebSources = async (
  params: WebSourcesParams
): Promise<WebSources | null> => {
  const { webSearchEnabled, userInput, imagePath, documentAttachedHere } =
    params;
  if (!WEB_SEARCH_ENABLED || !webSearchEnabled || !userInput.trim()) {
    return null;
  }
  const skippedForDocuments =
    RAG_PRIORITY_OVER_WEB_SEARCH && documentAttachedHere;
  const skippedForImage = RAG_PRIORITY_OVER_WEB_SEARCH && !!imagePath;
  const model = useLLMStore.getState().model;
  const ready =
    !skippedForDocuments &&
    !skippedForImage &&
    isWebSearchReady(model) &&
    hasMemoryForWebSearch(model);
  if (!ready) {
    showToast(
      WEB_SKIP_COPY[webSkipReason(skippedForDocuments, skippedForImage, model)]
    );
    return null;
  }
  return searchWeb(params);
};
