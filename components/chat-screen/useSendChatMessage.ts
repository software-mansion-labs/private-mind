import { Keyboard } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import {
  checkIfChatExists,
  type ChatSettings,
  type Message,
  type SourceDocument,
} from '../../database/chatRepository';
import { Model } from '../../database/modelRepository';
import { Attachment } from '../../hooks/useAttachment';
import { LFMEmbeddings } from '../../utils/lfmEmbeddings';
import { buildMessageSources } from '../../utils/messageSources';
import { isDeviceOnline } from '../../utils/network';
import { runWebSearch } from '../../utils/web/runWebSearch';
import type { WebIntentKind } from '../../utils/web/intentKind';
import { webViewScrapeProvider } from '../../utils/web/scrape/webViewScrapeProvider';
import { webContextCharBudget } from '../../utils/web/contextBudget';
import { WEB_SKIP_COPY, type WebSkipReason } from '../../constants/web-copy';
import {
  RAG_PRIORITY_OVER_WEB_SEARCH,
  WEB_BENCH_LOGS,
  WEB_OFFLOAD_LLM_FOR_EMBEDDINGS,
  WEB_SEARCH_ENABLED,
  WEB_SEARCH_OVERALL_TIMEOUT_MS,
} from '../../constants/web';
import {
  getModelProfile,
  isWebSearchReady,
} from '../../constants/model-profiles';
import {
  hasMemoryForWebSearch,
  isMemoryConstrained,
} from '../../utils/modelCompatibility';
import { persistImage } from '../../utils/persistImage';
import { toChatTitle } from '../../utils/chatLabel';
import { stripThinkMarkers } from '../../utils/thinking';
import { useChatStore } from '../../store/chatStore';
import { useLLMStore } from '../../store/llmStore';
import { useSourceStore } from '../../store/sourceStore';
import { useWebSearchStore } from '../../store/webSearchStore';
import { useEmbeddingModelStore } from '../../store/embeddingModelStore';
import type { MessagesHandle } from './Messages';

interface UseSendChatMessageOptions {
  chatId: number;
  model: Model | undefined;
  messageHistory: Message[];
  chatSettings: {
    systemPrompt: string;
    thinkingEnabled: boolean;
    webSearchEnabled: boolean;
  };
  enabledSources: number[];
  vectorStore: OPSQLiteVectorStore | null;
  embeddings: LFMEmbeddings | null;
  messagesRef: React.RefObject<MessagesHandle | null>;
  db: SQLiteDatabase;
  isGenerating: boolean;
  isModelLoading: boolean;
  isSwitching: boolean;
}

const webSkipReason = (
  skippedForDocPriority: boolean,
  model: Model | null
): WebSkipReason => {
  if (skippedForDocPriority) return 'documents';
  if (hasMemoryForWebSearch(model)) return 'model';
  return 'memory';
};

export const useSendChatMessage = ({
  chatId,
  model,
  messageHistory,
  chatSettings,
  enabledSources,
  vectorStore,
  embeddings,
  messagesRef,
  db,
  isGenerating,
  isModelLoading,
  isSwitching,
}: UseSendChatMessageOptions) => {
  const { sendChatMessage, runWithModelOffloaded } = useLLMStore();
  const { addChat, updateLastUsed, enableSource } = useChatStore();

  return async (
    userInput: string,
    imagePath?: string,
    attachments?: Attachment[]
  ): Promise<boolean> => {
    const hasDocuments = attachments?.some((a) => a.type === 'document');
    if (!userInput.trim() && !imagePath && !hasDocuments) return false;
    if (isModelLoading || isSwitching) return false;
    const llm = useLLMStore.getState();
    const busy = llm.isGenerating || llm.isProcessingPrompt;
    if (busy && llm.generatingForChatId !== chatId) {
      llm.interrupt();
    } else if (busy || isGenerating) {
      return false;
    }

    Keyboard.dismiss();
    messagesRef.current?.onMessageSent();

    let targetChatId = chatId!;
    const isNewChat = !(await checkIfChatExists(db, targetChatId));
    if (isNewChat) {
      const docName = attachments?.find((a) => a.type === 'document')?.name;
      const titleSource =
        stripThinkMarkers(userInput).trim() || docName || 'New chat';
      const newChatId = await addChat(toChatTitle(titleSource), model!.id);
      if (!newChatId) {
        messagesRef.current?.cancelMessageSent();
        return false;
      }
      targetChatId = newChatId;
      useWebSearchStore.getState().transfer(chatId, targetChatId);
    }

    let persistedImagePath: string | undefined = imagePath;
    if (imagePath) {
      try {
        persistedImagePath = await persistImage(imagePath);
      } catch (error) {
        console.error('Failed to persist image attachment:', error);
        Toast.show({
          type: 'defaultToast',
          text1: 'Failed to save image attachment.',
        });
        messagesRef.current?.cancelMessageSent();
        return false;
      }
    }

    updateLastUsed(targetChatId);
    useWebSearchStore.getState().resetTrace();

    const settings: ChatSettings = {
      systemPrompt: chatSettings.systemPrompt,
      thinkingEnabled: chatSettings.thinkingEnabled,
    };
    const docAttachments =
      attachments?.filter((a) => a.type === 'document') || [];
    const docName =
      docAttachments
        .map((a) => a.name)
        .filter(Boolean)
        .join(', ') || undefined;

    const modelProfile = getModelProfile(useLLMStore.getState().model);

    const digestOfThisChat = (): string | null => {
      const llmState = useLLMStore.getState();
      return llmState.activeChatDigestChatId === targetChatId
        ? llmState.activeChatDigest
        : null;
    };

    // Deferred so retrieval runs only after the optimistic message is on screen.
    const buildSources = async (signal?: AbortSignal) => {
      const allSources = useSourceStore.getState().sources;
      const existingSourceIds = new Set(allSources.map((source) => source.id));
      const attachmentSourceIds = (attachments || [])
        .filter((a) => a.type === 'document' && a.sourceId)
        .map((a) => a.sourceId!)
        .filter((sourceId) => {
          const exists = existingSourceIds.has(sourceId);
          if (!exists) {
            console.warn('Skipping missing attachment source before send', {
              chatId: targetChatId,
              sourceId,
            });
          }
          return exists;
        });

      let context: string[] = [];
      let sourceDocuments: SourceDocument[] = [];
      let preferredSourceDocuments: SourceDocument[] = [];
      let webIntent: string | undefined;
      let webIntentKind: WebIntentKind | undefined;
      let webSubQueries: string[] | undefined;
      let webWeak: boolean | undefined;
      let webSearchFailed: boolean | undefined;
      const hasRagSources =
        enabledSources.length > 0 || attachmentSourceIds.length > 0;
      if (vectorStore && hasRagSources) {
        const prepareSources = () =>
          buildMessageSources({
            userInput,
            attachmentSourceIds,
            enabledSources,
            sources: allSources,
            vectorStore,
            embeddings,
            maxRelevantChunks: modelProfile.ragMaxRelevantChunks,
            history: messageHistory,
            digest: digestOfThisChat() ?? undefined,
          });
        ({ context, sourceDocuments, preferredSourceDocuments } = embeddings
          ? await runWithModelOffloaded(
              () => embeddings.runWithLoadedModel(prepareSources),
              { restore: false }
            )
          : await prepareSources());
      }

      const skippedForDocPriority =
        RAG_PRIORITY_OVER_WEB_SEARCH && hasRagSources;
      const modelForWebSearch = useLLMStore.getState().model;

      const shouldRunWebSearch =
        WEB_SEARCH_ENABLED &&
        chatSettings.webSearchEnabled &&
        !skippedForDocPriority &&
        isWebSearchReady(modelForWebSearch) &&
        hasMemoryForWebSearch(modelForWebSearch) &&
        !!userInput.trim();

      if (
        WEB_SEARCH_ENABLED &&
        chatSettings.webSearchEnabled &&
        !shouldRunWebSearch &&
        !!userInput.trim()
      ) {
        Toast.show({
          type: 'defaultToast',
          text1:
            WEB_SKIP_COPY[
              webSkipReason(skippedForDocPriority, modelForWebSearch)
            ],
        });
      }

      if (shouldRunWebSearch) {
        const trimmedInput = userInput.trim();
        const lowMemory = isMemoryConstrained(useLLMStore.getState().model);
        useWebSearchStore.getState().setSearchingWeb(true);
        try {
          const embeddingModelReady =
            !lowMemory && useEmbeddingModelStore.getState().status === 'ready';
          const searchStartedAt = Date.now();
          let isolateTotalMs = 0;
          const {
            context: webContext,
            sourceDocuments: webSources,
            telemetry: webTelemetry,
          } = await runWebSearch({
            query: trimmedInput,
            history: messageHistory,
            digest: digestOfThisChat() ?? undefined,
            provider: webViewScrapeProvider,
            embeddings,
            embeddingModelReady,
            profile: modelProfile,
            contextOffset: context.length,
            contextCharBudget: webContextCharBudget(
              useLLMStore.getState().model,
              context,
              chatSettings.systemPrompt,
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
            generate: (messages) =>
              useLLMStore.getState().generateUtility(messages),
            onProgress: (event) =>
              useWebSearchStore.getState().pushWebSearchEvent(event),
          });
          context = [...context, ...webContext];
          sourceDocuments = [...sourceDocuments, ...webSources];
          if (webSources.length > 0) {
            webIntent = webTelemetry.intent || undefined;
            webIntentKind = webTelemetry.intentKind;
            webSubQueries = webTelemetry.plannedQueries;
            webWeak = webTelemetry.finalLabel === 'incorrect';
          } else {
            webSearchFailed =
              webTelemetry.needsSearch && !webTelemetry.skippedReason;
          }
          if (WEB_BENCH_LOGS) {
            console.log(
              `[BENCH] offload=${WEB_OFFLOAD_LLM_FOR_EMBEDDINGS} search=${
                Date.now() - searchStartedAt
              }ms isolate=${isolateTotalMs}ms sources=${webSources.length} read=${
                webSources.filter((source) => source.read).length
              }`
            );
          }
        } catch (error) {
          console.warn('Web search failed', error);
          webSearchFailed = true;
        } finally {
          useWebSearchStore.getState().setSearchingWeb(false);
          webViewScrapeProvider.releaseHost();
        }
        if (webSearchFailed && !signal?.aborted) {
          Toast.show({
            type: 'defaultToast',
            text1:
              'Couldn’t find anything useful online — answering without the web.',
          });
        }
      }

      for (const sourceId of attachmentSourceIds) {
        if (!enabledSources.includes(sourceId)) {
          await enableSource(targetChatId, sourceId);
        }
      }

      return {
        context,
        sourceDocuments,
        preferredSourceDocuments,
        webIntent,
        webIntentKind,
        webSubQueries,
        webWeak,
        webSearchFailed,
      };
    };

    const generation = sendChatMessage(
      userInput,
      targetChatId,
      buildSources,
      settings,
      persistedImagePath,
      docName
    );

    if (isNewChat && targetChatId !== chatId) {
      router.replace(`/chat/${targetChatId}`);
    }

    return generation;
  };
};
