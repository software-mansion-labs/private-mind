import { create } from 'zustand';
import { LLMModule } from 'react-native-executorch';
import { Model } from '../database/modelRepository';
import { SQLiteDatabase } from 'expo-sqlite';
import {
  ChatSettings,
  getChatMessages,
  Message,
  persistMessage,
  SourceDocument,
} from '../database/chatRepository';
import DeviceInfo from 'react-native-device-info';
import { BENCHMARK_PROMPT } from '../constants/default-benchmark';
import { BenchmarkResultPerformanceNumbers } from '../database/benchmarkRepository';
import { type Message as ExecutorchMessage } from 'react-native-executorch';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import { Feedback } from '../utils/Feedback';
import { prepareMessagesForLLM } from '../utils/promptUtils';
import {
  detectGroundingCaveats,
  isQuestionEchoAnswer,
  isWrongLanguageAnswer,
  pickCitationsByAnswer,
  restrictCitationsToContext,
} from '../utils/messageSources';
import { sourcesPresentInContext } from '../utils/contextUtils';
import { normalizeModelText } from '../utils/normalizeModelText';
import { truncateAtRepeatedClause } from '../utils/loopDetection';
import { useSettingsStore } from './settingsStore';
import { useWebSearchStore } from './webSearchStore';
import { getGenerationConfigForModel } from '../constants/default-models';
import { WEB_SEARCH_OVERALL_TIMEOUT_MS } from '../constants/web';

export interface LLMStore {
  isLoading: boolean;
  isGenerating: boolean;
  isProcessingPrompt: boolean;
  isBenchmarking: boolean;
  db: SQLiteDatabase | null;
  model: Model | null;
  performance: {
    tokenCount: number;
    firstTokenTime: number;
  };
  activeChatId: number | null;
  generatingForChatId: number | null;
  activeChatMessages: Message[];
  generationError: { chatId: number; message: string } | null;

  setDB: (db: SQLiteDatabase) => void;
  loadModel: (model: Model, hardReload?: boolean) => Promise<void>;
  runWithModelOffloaded: <T>(
    operation: () => Promise<T>,
    options?: { restore?: boolean }
  ) => Promise<T>;
  setActiveChatId: (chatId: number | null) => Promise<void>;
  sendChatMessage: (
    newMessage: string,
    chatId: number,
    buildSources: (signal?: AbortSignal) => Promise<{
      context: string[];
      sourceDocuments?: SourceDocument[];
      preferredSourceDocuments?: SourceDocument[];
      webIntent?: string;
      webSubQueries?: string[];
      webWeak?: boolean;
      webSearchFailed?: boolean;
    }>,
    settings: ChatSettings,
    imagePath?: string,
    documentName?: string,
    isRetry?: boolean
  ) => Promise<void>;
  retryLastGeneration: () => Promise<void>;
  runBenchmark: () => Promise<BenchmarkResultPerformanceNumbers | undefined>;
  generateUtility: (messages: ExecutorchMessage[]) => Promise<string>;
  interrupt: () => void;
  sendEventMessage: (chatId: number, message: string) => Promise<void>;
  refreshActiveChatMessages: () => Promise<void>;
}

let llmInstance: LLMModule | null = null;
let modelOffloadChain: Promise<void> = Promise.resolve();
let modelLoadChain: Promise<void> = Promise.resolve();

type FailedGenerationRequest = {
  newMessage: string;
  chatId: number;
  buildSources: Parameters<LLMStore['sendChatMessage']>[2];
  settings: ChatSettings;
  imagePath?: string;
  documentName?: string;
  reusePersistedUser: boolean;
};

let failedGenerationRequest: FailedGenerationRequest | null = null;

let streamBuffer = '';
let streamTokenCount = 0;
let streamFirstTokenTime = 0;
let streamFlushScheduled = false;

const resetStreamState = () => {
  streamBuffer = '';
  streamTokenCount = 0;
  streamFirstTokenTime = 0;
  streamFlushScheduled = false;
};

let suppressUtilityStreaming = false;
let utilityGenerating = false;
let sendAbortController: AbortController | null = null;
let messageLocalIdSeq = 0;
const nextMessageLocalId = () => (messageLocalIdSeq += 1);

const buildAssistantPlaceholder = (
  chatId: number,
  model: Model | null
): Message => ({
  role: 'assistant',
  content: '',
  modelName: model?.modelName,
  chatId,
  timestamp: Date.now(),
  id: -1,
  localId: nextMessageLocalId(),
});

const withNoThink = (messages: ExecutorchMessage[]): ExecutorchMessage[] => {
  if (messages.length === 0) return messages;
  const last = messages.length - 1;
  return messages.map((message, index) =>
    index === last
      ? { ...message, content: `${message.content} /no_think` }
      : message
  );
};

const calculatePerformanceMetrics = (
  startTime: number,
  endTime: number,
  firstTokenTime: number,
  tokenCount: number
) => {
  const totalTime = endTime - startTime;
  const timeToFirstToken = firstTokenTime
    ? firstTokenTime - startTime
    : totalTime;
  const timeAfterFirst = Math.max(1, totalTime - timeToFirstToken);
  const tokensPerSecond = tokenCount / (timeAfterFirst / 1000);

  return {
    totalTime,
    timeToFirstToken,
    tokensPerSecond,
  };
};

const createMemoryTracker = (onUpdate: (usedMemory: number) => void) => {
  if (Platform.OS !== 'ios') {
    return { start: () => {}, stop: () => {} };
  }
  let trackerId: ReturnType<typeof setInterval>;
  return {
    start: () => {
      trackerId = setInterval(async () => {
        try {
          onUpdate(await DeviceInfo.getUsedMemory());
        } catch (e) {
          console.warn('Unable to read memory:', e);
        }
      }, 3000);
    },
    stop: () => clearInterval(trackerId),
  };
};

const waitForModelLoad = async (get: () => LLMStore): Promise<void> => {
  while (get().isLoading) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

const waitForSettingsHydration = async (): Promise<void> => {
  if (useSettingsStore.getState().hasHydrated) return;
  await new Promise<void>((resolve) => {
    const unsubscribe = useSettingsStore.subscribe((state) => {
      if (state.hasHydrated) {
        unsubscribe();
        resolve();
      }
    });
  });
};

const waitForModelToBecomeIdle = async (get: () => LLMStore) => {
  while (get().isLoading || get().isGenerating) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

type StoreSet = (
  partial: Partial<LLMStore> | ((state: LLMStore) => Partial<LLMStore>)
) => void;

const unloadLLM = () => {
  if (!llmInstance) return false;
  llmInstance.delete();
  llmInstance = null;
  return true;
};

const loadModelInstance = async (
  model: Model,
  hardReload: boolean,
  set: StoreSet,
  get: () => LLMStore
) => {
  const { model: currentModel } = get();
  if (model.id === currentModel?.id && llmInstance && !hardReload) {
    return;
  }
  unloadLLM();

  resetStreamState();
  set({ isLoading: true, model });

  const flushStream = () => {
    streamFlushScheduled = false;
    if (!streamBuffer) return;
    const text = streamBuffer;
    streamBuffer = '';
    const snapshot = get();
    const shouldAppendToActiveChat =
      snapshot.generatingForChatId === snapshot.activeChatId &&
      snapshot.activeChatMessages.at(-1)?.role === 'assistant';
    set((state) => ({
      isProcessingPrompt: false,
      performance: {
        tokenCount: streamTokenCount,
        firstTokenTime: streamFirstTokenTime,
      },
      activeChatMessages: shouldAppendToActiveChat
        ? state.activeChatMessages.map((msg, index) =>
            index === state.activeChatMessages.length - 1
              ? { ...msg, content: msg.content + text }
              : msg
          )
        : state.activeChatMessages,
    }));
  };

  try {
    llmInstance = await LLMModule.fromModelName(
      {
        modelName: 'custom' as Parameters<
          typeof LLMModule.fromModelName
        >[0]['modelName'],
        modelSource: model.modelPath,
        tokenizerSource: model.tokenizerPath,
        tokenizerConfigSource: model.tokenizerConfigPath,
        capabilities: model.vision ? (['vision'] as const) : undefined,
      },
      () => {},
      (token) => {
        if (suppressUtilityStreaming) return;

        const isFirstToken = streamTokenCount === 0;

        if (isFirstToken && !get().isBenchmarking) {
          Feedback.firstToken();
        }

        /* Temporary solution to handle interrupt during prefill, needs to be fixed in the
        react-native-executorch library
        */
        if (isFirstToken) {
          const snapshot = get();
          if (!snapshot.isProcessingPrompt && !snapshot.isGenerating) {
            llmInstance?.interrupt();
            return;
          }
          streamFirstTokenTime = performance.now();
        }

        streamTokenCount += 1;
        streamBuffer += token;
        if (!streamFlushScheduled) {
          streamFlushScheduled = true;
          requestAnimationFrame(flushStream);
        }
      }
    );

    const generationConfig = getGenerationConfigForModel(model);
    if (generationConfig) {
      llmInstance.configure({ generationConfig });
    }

    set({ isLoading: false });
  } catch (e) {
    console.error('Error loading model:', e);
    unloadLLM();
    set({ isLoading: false, model: null });
  }
};

const updateChatStateForGeneration = (
  set: (
    partial: Partial<LLMStore> | ((state: LLMStore) => Partial<LLMStore>)
  ) => void,
  phase: 'start' | 'generating' | 'complete' | 'failed',
  data?: {
    chatId?: number;
    activeChatMessages?: Message[];
    userMessage?: Message;
    assistantPlaceholder?: Message;
    assistantMessage?: Message;
    timeToFirstToken?: number;
    tokensPerSecond?: number;
  }
) => {
  switch (phase) {
    case 'start':
      set({
        isProcessingPrompt: true,
        generatingForChatId: data?.chatId,
        ...(data?.chatId !== undefined ? { activeChatId: data.chatId } : {}),
        activeChatMessages: data?.activeChatMessages,
      });
      break;
    case 'generating':
      resetStreamState();
      set({
        isGenerating: true,
        performance: {
          tokenCount: 0,
          firstTokenTime: 0,
        },
      });
      break;
    case 'complete':
      streamBuffer = '';
      if (
        data?.timeToFirstToken !== undefined &&
        data?.tokensPerSecond !== undefined
      ) {
        set((state) => ({
          activeChatMessages: state.activeChatMessages.map((msg, index) =>
            index === state.activeChatMessages.length - 1 &&
            msg.role === 'assistant'
              ? {
                  ...msg,
                  id: data.assistantMessage?.id ?? msg.id,
                  content: data.assistantMessage?.content ?? msg.content,
                  sourceDocuments:
                    data.assistantMessage?.sourceDocuments ??
                    msg.sourceDocuments,
                  timeToFirstToken: data.timeToFirstToken!,
                  tokensPerSecond: data.tokensPerSecond!,
                }
              : msg
          ),
          isGenerating: false,
          generatingForChatId: null,
          isProcessingPrompt: false,
        }));
      } else {
        set({
          isGenerating: false,
          generatingForChatId: null,
          isProcessingPrompt: false,
        });
      }
      break;
    case 'failed':
      streamBuffer = '';
      // Drop the empty assistant placeholder left behind when generation
      // failed, was interrupted before any tokens, or produced no response.
      set((state) => {
        const messages = state.activeChatMessages;
        const last = messages[messages.length - 1];
        const cleaned =
          last && last.role === 'assistant' && last.id === -1 && !last.content
            ? messages.slice(0, -1)
            : messages;
        return {
          activeChatMessages: cleaned,
          isGenerating: false,
          generatingForChatId: null,
          isProcessingPrompt: false,
        };
      });
      break;
  }
};

const describeGenerationFailure = (
  finalResponse: string | null | undefined,
  currentQuestion: string | undefined
): string => {
  if (!finalResponse) return 'The model returned an empty response';
  if (isQuestionEchoAnswer(finalResponse, currentQuestion)) {
    return 'The model echoed the question back with no actual answer';
  }
  return 'The model answered in the wrong language';
};

const generateLLMResponse = async (
  messages: ExecutorchMessage[],
  get: () => LLMStore
): Promise<{
  response: string | null;
  performance: { timeToFirstToken: number; tokensPerSecond: number };
}> => {
  if (!llmInstance) {
    return {
      response: null,
      performance: { timeToFirstToken: 0, tokensPerSecond: 0 },
    };
  }
  const preparedMessages = messages.map((msg) =>
    msg.mediaPath
      ? {
          ...msg,
          content: [
            { type: 'image' },
            { type: 'text', text: msg.content as string },
          ] as unknown as string,
        }
      : msg
  );

  const startTime = performance.now();
  const finalResponse = await llmInstance.generate(preparedMessages);
  const endTime = performance.now();

  if (finalResponse) {
    const { timeToFirstToken, tokensPerSecond } = calculatePerformanceMetrics(
      startTime,
      endTime,
      get().performance.firstTokenTime,
      llmInstance.getGeneratedTokenCount()
    );

    return {
      response: finalResponse,
      performance: { timeToFirstToken, tokensPerSecond },
    };
  }

  return {
    response: null,
    performance: { timeToFirstToken: 0, tokensPerSecond: 0 },
  };
};

export const useLLMStore = create<LLMStore>((set, get) => ({
  isLoading: false,
  isGenerating: false,
  isProcessingPrompt: false,
  isBenchmarking: false,
  db: null,
  generatingForChatId: null,
  activeChatId: null,
  model: null,
  performance: {
    tokenCount: 0,
    firstTokenTime: 0,
  },
  activeChatMessages: [],
  generationError: null,

  setDB: (db) => set({ db }),

  setActiveChatId: async (chatId) => {
    const db = get().db;
    if (!db) {
      console.warn('Database not initialized');
      return;
    }
    //Once the user selects a chat room, we load the messages for that chat and set it as the active chat.
    if (chatId !== null) {
      const generatingHere = get().generatingForChatId === chatId;
      const holdsThisChat = get().activeChatMessages.some(
        (message) => message.chatId === chatId
      );
      if (generatingHere && holdsThisChat) {
        set({ activeChatId: chatId });
        return;
      }
      const messageHistory = await getChatMessages(db, chatId);
      set({
        activeChatId: chatId,
        activeChatMessages: generatingHere
          ? [...messageHistory, buildAssistantPlaceholder(chatId, get().model)]
          : messageHistory,
      });
    } else {
      set({ activeChatId: null, activeChatMessages: [] });
    }
  },

  loadModel: async (model, hardReload: boolean = false) => {
    const { model: currentModel } = get();
    if (model.id === currentModel?.id && llmInstance && !hardReload) {
      return;
    }
    const network = await NetInfo.fetch().catch(() => null);
    if (network?.isConnected === false) {
      Toast.show({
        type: 'defaultToast',
        text1: 'Model cannot be loaded without internet connection.',
      });
      return;
    }
    const result = modelLoadChain.then(async () => {
      await modelOffloadChain;
      await loadModelInstance(model, hardReload, set, get);
    });
    modelLoadChain = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  },

  runWithModelOffloaded: <T>(
    operation: () => Promise<T>,
    options: { restore?: boolean } = {}
  ): Promise<T> => {
    const result = modelOffloadChain.then(async () => {
      await waitForModelToBecomeIdle(get);

      const modelToRestore = get().model;
      const shouldRestore =
        options.restore !== false && !!llmInstance && !!modelToRestore;
      unloadLLM();

      let operationResult!: T;
      let operationFailed = false;
      let operationError: unknown;
      try {
        operationResult = await operation();
      } catch (error) {
        operationFailed = true;
        operationError = error;
      }

      let restoreError: Error | null = null;
      if (
        shouldRestore &&
        modelToRestore &&
        get().model?.id === modelToRestore.id
      ) {
        await loadModelInstance(modelToRestore, true, set, get);
        if (!llmInstance) {
          restoreError = new Error('Failed to restore the language model');
        }
      }

      if (operationFailed) throw operationError;
      if (restoreError) throw restoreError;
      return operationResult;
    });

    modelOffloadChain = result.then(
      () => undefined,
      () => undefined
    );

    return result;
  },

  sendChatMessage: async (
    newMessage,
    chatId,
    buildSources,
    settings,
    imagePath,
    documentName,
    isRetry = false
  ) => {
    const { db, model: currentModel, activeChatMessages } = get();
    if (!db || !currentModel) {
      console.warn('LLM not ready or DB not set');
      return;
    }

    const tempUserId = -Date.now();
    const userMessage: Message = {
      id: tempUserId,
      localId: nextMessageLocalId(),
      role: 'user',
      content: newMessage,
      chatId,
      timestamp: Date.now(),
      imagePath,
      documentName,
    };
    const assistantPlaceholder = buildAssistantPlaceholder(
      chatId,
      currentModel
    );

    set({ generationError: null });
    updateChatStateForGeneration(set, 'start', {
      chatId,
      activeChatMessages: isRetry
        ? [...activeChatMessages, assistantPlaceholder]
        : [...activeChatMessages, userMessage, assistantPlaceholder],
    });

    let userMessagePersisted = isRetry;
    const markGenerationFailed = (error: unknown, showToUser = true) => {
      unloadLLM();
      updateChatStateForGeneration(set, 'failed');

      if (!userMessagePersisted && !isRetry) {
        set((state) => ({
          activeChatMessages: state.activeChatMessages.filter(
            (message) => message.id !== tempUserId
          ),
        }));
      }

      if (!showToUser) return;
      failedGenerationRequest = {
        newMessage,
        chatId,
        buildSources,
        settings,
        imagePath,
        documentName,
        reusePersistedUser: userMessagePersisted,
      };
      if (get().activeChatId === chatId) {
        set({
          generationError: {
            chatId,
            message: 'Failed to generate a response.',
          },
        });
      }
      console.error('Chat sendMessage failed', error);
    };

    try {
      if (!isRetry) {
        const userMessageId = await persistMessage(db, {
          role: 'user',
          content: newMessage,
          chatId,
          imagePath,
          documentName,
        });
        userMessagePersisted = true;
        set((state) => ({
          activeChatMessages: state.activeChatMessages.map((msg) =>
            msg.id === tempUserId ? { ...msg, id: userMessageId } : msg
          ),
        }));
      }

      const abortController = new AbortController();
      sendAbortController = abortController;
      const searchTimeout = setTimeout(() => {
        const webSearch = useWebSearchStore.getState();
        if (webSearch.isSearchingWeb) {
          webSearch.pushWebSearchEvent({ type: 'timeout' });
        }
        abortController.abort();
      }, WEB_SEARCH_OVERALL_TIMEOUT_MS);
      let built;
      try {
        built = await buildSources(abortController.signal);
      } finally {
        clearTimeout(searchTimeout);
      }
      const {
        context,
        sourceDocuments,
        preferredSourceDocuments,
        webIntent,
        webSubQueries,
        webWeak,
        webSearchFailed,
      } = built;

      if (!get().isProcessingPrompt) {
        updateChatStateForGeneration(set, 'failed');
        return;
      }

      await get().loadModel(currentModel, isRetry);
      await waitForModelLoad(get);
      if (!llmInstance && get().isProcessingPrompt) {
        await get().loadModel(currentModel, true);
        await waitForModelLoad(get);
      }
      if (!llmInstance) {
        throw new Error('Failed to load the language model');
      }

      if (!get().isProcessingPrompt) {
        unloadLLM();
        updateChatStateForGeneration(set, 'failed');
        return;
      }

      await waitForSettingsHydration();

      const messagesWithSystemPrompt = prepareMessagesForLLM(
        get().activeChatMessages,
        context,
        settings,
        currentModel,
        useSettingsStore.getState().customSystemPrompt,
        preferredSourceDocuments,
        sourceDocuments,
        1,
        webIntent,
        webSubQueries,
        webWeak,
        webSearchFailed
      );

      const lastPreparedMessage = messagesWithSystemPrompt.at(-1);
      const lastPreparedContent =
        typeof lastPreparedMessage?.content === 'string'
          ? lastPreparedMessage.content
          : JSON.stringify(lastPreparedMessage?.content ?? '');

      const seenSourceDocuments = restrictCitationsToContext(
        sourceDocuments ?? [],
        lastPreparedContent,
        preferredSourceDocuments ?? []
      );

      const webSourceDocuments = seenSourceDocuments.filter(
        (doc) => doc.kind === 'web'
      );
      if (webSourceDocuments.length > 0 && get().activeChatId === chatId) {
        set((state) => ({
          activeChatMessages: state.activeChatMessages.map((msg) =>
            msg.id === -1 && msg.role === 'assistant' && msg.chatId === chatId
              ? { ...msg, sourceDocuments: webSourceDocuments }
              : msg
          ),
        }));
      }

      llmInstance?.configure({
        generationConfig: getGenerationConfigForModel(
          currentModel,
          context.some((chunk) => chunk.trim().length > 0)
        ),
      });

      // Set generation state and generate response
      updateChatStateForGeneration(set, 'generating');
      let generation: Awaited<ReturnType<typeof generateLLMResponse>>;
      let effectivePrepared = messagesWithSystemPrompt;
      try {
        generation = await generateLLMResponse(messagesWithSystemPrompt, get);
      } catch (error) {
        console.warn(
          'Chat generation failed, retrying with a reduced prompt',
          error
        );
        updateChatStateForGeneration(set, 'generating');
        effectivePrepared = prepareMessagesForLLM(
          get().activeChatMessages,
          context,
          settings,
          currentModel,
          useSettingsStore.getState().customSystemPrompt,
          preferredSourceDocuments,
          sourceDocuments,
          0.5,
          webIntent,
          webSubQueries,
          webWeak,
          webSearchFailed
        );
        generation = await generateLLMResponse(effectivePrepared, get);
      }
      const { response: rawResponse, performance: responsePerformance } =
        generation;
      const finalResponse = rawResponse
        ? truncateAtRepeatedClause(normalizeModelText(rawResponse))
        : rawResponse;
      const currentQuestion = get().activeChatMessages.findLast(
        (msg) => msg.role === 'user'
      )?.content;
      // Handle successful response
      if (
        finalResponse &&
        !isQuestionEchoAnswer(finalResponse, currentQuestion) &&
        !isWrongLanguageAnswer(finalResponse, currentQuestion)
      ) {
        const effectiveLast = effectivePrepared.at(-1);
        const effectiveContent =
          typeof effectiveLast?.content === 'string'
            ? effectiveLast.content
            : JSON.stringify(effectiveLast?.content ?? '');
        const effectiveSeen =
          effectivePrepared === messagesWithSystemPrompt
            ? seenSourceDocuments
            : restrictCitationsToContext(
                sourceDocuments ?? [],
                effectiveContent,
                preferredSourceDocuments ?? []
              );
        const citedSourceDocuments = pickCitationsByAnswer(
          effectiveSeen,
          finalResponse,
          preferredSourceDocuments ?? [],
          sourcesPresentInContext(effectiveContent)
        );
        const groundingCaveats = context.some((chunk) => chunk.trim())
          ? detectGroundingCaveats(
              finalResponse,
              currentQuestion,
              effectiveContent
            )
          : [];
        const assistantMessageId = await persistMessage(db, {
          ...assistantPlaceholder,
          content: finalResponse,
          sourceDocuments: citedSourceDocuments,
          groundingCaveats,
          tokensPerSecond: responsePerformance.tokensPerSecond,
          timeToFirstToken: responsePerformance.timeToFirstToken,
        });

        if (get().activeChatId === chatId) {
          updateChatStateForGeneration(set, 'complete', {
            assistantMessage: {
              ...assistantPlaceholder,
              id: assistantMessageId,
              content: finalResponse,
              sourceDocuments: citedSourceDocuments,
              groundingCaveats,
              tokensPerSecond: responsePerformance.tokensPerSecond,
              timeToFirstToken: responsePerformance.timeToFirstToken,
            },
            timeToFirstToken: responsePerformance.timeToFirstToken,
            tokensPerSecond: responsePerformance.tokensPerSecond,
          });
        } else {
          updateChatStateForGeneration(set, 'complete');
        }
        failedGenerationRequest = null;
        set({ generationError: null });
      } else {
        markGenerationFailed(
          new Error(describeGenerationFailure(finalResponse, currentQuestion))
        );
      }
    } catch (e) {
      const wasInterrupted = !get().isGenerating && !get().isProcessingPrompt;
      markGenerationFailed(e, !wasInterrupted);
    } finally {
      sendAbortController = null;
    }
  },

  retryLastGeneration: async () => {
    const request = failedGenerationRequest;
    if (
      !request ||
      get().isGenerating ||
      get().isProcessingPrompt ||
      get().activeChatId !== request.chatId
    ) {
      return;
    }

    await get().sendChatMessage(
      request.newMessage,
      request.chatId,
      request.buildSources,
      request.settings,
      request.imagePath,
      request.documentName,
      request.reusePersistedUser
    );
  },

  sendEventMessage: async (chatId: number, content: string) => {
    const db = get().db;
    if (!db) return;

    const eventMessage: Omit<Message, 'id'> = {
      role: 'event',
      content: content,
      chatId,
      timestamp: Date.now(),
    };

    const eventMessageId = await persistMessage(db, eventMessage);

    set((state) => ({
      activeChatMessages: [
        ...state.activeChatMessages,
        { ...eventMessage, id: eventMessageId },
      ],
    }));
  },

  runBenchmark: async () => {
    let runPeakMemory = 0;
    const memoryTracker = createMemoryTracker((usedMemory) => {
      if (usedMemory > runPeakMemory) runPeakMemory = usedMemory;
    });

    try {
      resetStreamState();
      set({
        isGenerating: true,
        performance: { tokenCount: 0, firstTokenTime: 0 },
        isBenchmarking: true,
      });
      if (!llmInstance || !get().model) {
        return;
      }

      memoryTracker.start();

      const startTime = performance.now();
      await llmInstance.generate([
        {
          role: 'system',
          content:
            "/no_think Copy the text provided by user, don't think, just copy.",
        },
        { role: 'user', content: BENCHMARK_PROMPT },
      ]);
      const endTime = performance.now();
      memoryTracker.stop();

      const { firstTokenTime } = get().performance;
      const { totalTime, timeToFirstToken, tokensPerSecond } =
        calculatePerformanceMetrics(
          startTime,
          endTime,
          firstTokenTime,
          llmInstance.getGeneratedTokenCount()
        );

      return {
        totalTime,
        timeToFirstToken,
        tokensPerSecond,
        tokensGenerated: llmInstance.getGeneratedTokenCount(),
        peakMemory: runPeakMemory,
      };
    } catch {
      memoryTracker.stop();
    } finally {
      set({ isGenerating: false, isBenchmarking: false });
    }
  },

  generateUtility: async (messages) => {
    if (!llmInstance || get().isLoading || utilityGenerating) return '';
    utilityGenerating = true;
    suppressUtilityStreaming = true;
    const model = get().model;
    try {
      const prepared = model?.thinking ? withNoThink(messages) : messages;
      if (model) {
        llmInstance.configure({
          generationConfig: getGenerationConfigForModel(model, true),
        });
      }
      const result = await llmInstance.generate(prepared);
      return typeof result === 'string' ? result : '';
    } catch (error) {
      console.warn('generateUtility failed', error);
      return '';
    } finally {
      if (model) {
        llmInstance?.configure({
          generationConfig: getGenerationConfigForModel(model),
        });
      }
      suppressUtilityStreaming = false;
      utilityGenerating = false;
    }
  },

  interrupt: () => {
    sendAbortController?.abort();
    const state = get();
    if (state.isGenerating && llmInstance) {
      llmInstance.interrupt();
    }

    if (state.isGenerating || state.isProcessingPrompt) {
      set({
        isGenerating: false,
        isProcessingPrompt: false,
        generatingForChatId: null,
      });
    }
  },

  refreshActiveChatMessages: async () => {
    const { db, activeChatId } = get();
    if (!db || !activeChatId) return;

    const messageHistory = await getChatMessages(db, activeChatId);
    set({ activeChatMessages: messageHistory });
  },
}));
