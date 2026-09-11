import { estimatePromptTokens } from '../constants/context-window';
import { mapOutsideThink, stripThinkBlocks } from '../utils/thinking';
import { create } from 'zustand';
import { LLMModule } from 'react-native-executorch';
import { Model } from '../database/modelRepository';
import { SQLiteDatabase } from 'expo-sqlite';
import {
  ChatSettings,
  getChatDigest,
  getChatMessages,
  Message,
  persistMessage,
  setChatDigest,
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
import {
  answerLanguageAnchor,
  focusedRetrySystemPrompt,
  prepareMessagesForLLM,
} from '../utils/promptUtils';
import { detectQuestionLanguage } from '../utils/questionLanguage';
import {
  detectGroundingCaveats,
  claimsMissingEvidenceItHas,
  answerUsesNoRetrievedEvidence,
  answerStatesFigure,
  buriesFigureContextOffers,
  evidenceLinesFor,
  aspectsMissingFromAnswer,
  humanizeSourceReferences,
  isCircularNonAnswer,
  isDanglingListAnswer,
  isQuestionEchoAnswer,
  isWrongLanguageAnswer,
  retryDropsGroundedDetail,
  stripEchoedQuestionPrefix,
  stripSourceLabels,
  pickCitationsByAnswer,
  restrictCitationsToContext,
  sourcesBlockOf,
} from '../utils/messageSources';
import { sourcesPresentInContext } from '../utils/contextUtils';
import { normalizeModelText } from '../utils/normalizeModelText';
import { truncateAtRepeatedClause } from '../utils/loopDetection';
import { recordAnswerTrace, type AnswerRetry } from '../utils/answerTrace';
import { updateConversationDigest } from '../utils/conversationDigest';
import type { WebIntentKind } from '../utils/web/intentKind';
import { useSettingsStore } from './settingsStore';
import { useWebSearchStore } from './webSearchStore';
import { getGenerationConfigForModel } from '../constants/default-models';

export interface LLMStore {
  isLoading: boolean;
  isGenerating: boolean;
  isProcessingPrompt: boolean;
  isRefining: boolean;
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
  activeChatDigest: string | null;
  activeChatDigestChatId: number | null;
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
      webIntentKind?: WebIntentKind;
      webSubQueries?: string[];
      webWeak?: boolean;
      webSearchFailed?: boolean;
    }>,
    settings: ChatSettings,
    imagePath?: string,
    documentName?: string,
    isRetry?: boolean
  ) => Promise<boolean>;
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
let streamedSoFar = '';

const resetStreamState = () => {
  streamBuffer = '';
  streamTokenCount = 0;
  streamFirstTokenTime = 0;
  streamFlushScheduled = false;
  streamedSoFar = '';
};

let suppressUtilityStreaming = false;
let utilityGenerating = false;
let utilityChain: Promise<void> = Promise.resolve();
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
  while (get().isLoading || get().isGenerating || utilityGenerating) {
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
    streamedSoFar += text;
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
      streamedSoFar = '';
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
                  groundingCaveats:
                    data.assistantMessage?.groundingCaveats ??
                    msg.groundingCaveats,
                  timeToFirstToken: data.timeToFirstToken!,
                  tokensPerSecond: data.tokensPerSecond!,
                }
              : msg
          ),
          isGenerating: false,
          isRefining: false,
          generatingForChatId: null,
          isProcessingPrompt: false,
        }));
      } else {
        set({
          isGenerating: false,
          isRefining: false,
          generatingForChatId: null,
          isProcessingPrompt: false,
        });
      }
      break;
    case 'failed':
      streamBuffer = '';
      streamedSoFar = '';
      // Drop the empty assistant placeholder left behind when generation
      // failed, was interrupted before any tokens, or produced no response.
      set((state) => {
        const messages = state.activeChatMessages;
        const last = messages[messages.length - 1];
        const cleaned =
          last &&
          last.role === 'assistant' &&
          last.id === -1 &&
          !stripThinkBlocks(last.content).trim()
            ? messages.slice(0, -1)
            : messages;
        return {
          activeChatMessages: cleaned,
          isGenerating: false,
          isRefining: false,
          generatingForChatId: null,
          isProcessingPrompt: false,
        };
      });
      useWebSearchStore.getState().resetTrace();
      break;
  }
};

const DANGLING_LIST_CONTINUATION_PROMPT =
  'You started a list but stopped right after the introduction, with no items. ' +
  'Continue now with ONLY the actual list items — do not repeat or rephrase the ' +
  'introduction, and do not add any other commentary.';

const CIRCULAR_ANSWER_RETRY_PROMPT =
  'That reply only talked about the sources instead of answering. State the ' +
  'answer itself now, in your own words, and mention a source only where it ' +
  'backs a specific fact.';

const QUESTION_ECHO_RETRY_PROMPT =
  'That reply only repeated the question back instead of answering it. Answer ' +
  'the question now, directly, using the information you were given. Do not ' +
  'restate or rephrase the question.';

const NO_ANSWER_FALLBACK: Record<string, string> = {
  pl: 'Nie udało mi się odpowiedzieć na to pytanie na podstawie znalezionych źródeł.',
  en: 'I could not answer this question from the sources I found.',
};

const noAnswerFallback = (question: string | undefined): string => {
  const code = detectQuestionLanguage(question ?? '')?.code ?? 'en';
  return NO_ANSWER_FALLBACK[code] ?? NO_ANSWER_FALLBACK.en!;
};

const EVIDENCE_PRESENT_RETRY_PROMPT =
  'The block does contain a figure of the kind the question asks for. Read it ' +
  'again, including the page titles, find that value and answer with it. Only ' +
  'if it truly is not there, say so.';

const SOURCES_COVER_TOPIC_RETRY_PROMPT =
  'The sources do discuss what the question asks about. Answer the ' +
  'question directly in your first sentence with the fact or figure the ' +
  'sources give, exactly as they give it. Do not describe, list or ' +
  'summarize the sources. If they cover it only in part, give that part ' +
  'instead of refusing.';

const quotedEvidenceLines = (lines: string[]): string =>
  lines.map((line) => `"${line}"`).join('\n');

const focusedEvidencePrompt = (question: string, lines: string[]): string =>
  'These lines were quoted from the sources retrieved for the question ' +
  'below. Answer it in one or two sentences, giving the figure they state ' +
  'in the first sentence, exactly as they give it. If the lines do not ' +
  'hold it, say the sources do not state it.\n' +
  `${quotedEvidenceLines(lines)}\n\nQuestion: ${question}`;

const aspectCoverageRetryPrompt = (aspects: string[]): string =>
  'The answer does not address: ' +
  aspects.map((aspect) => `"${aspect}"`).join(', ') +
  '. The sources do cover it. Write the complete answer again: keep what you ' +
  'already said and add what the sources say about that part as well.';

const WRONG_LANGUAGE_RETRY_PROMPT =
  'That reply was written in the wrong language. Write the same answer again, ' +
  'with the same facts, in the language of the question, and do not switch ' +
  'language or script partway through.';

const tidyVisibleAnswer = (response: string): string =>
  mapOutsideThink(response, (segment) =>
    truncateAtRepeatedClause(normalizeModelText(segment))
  );

const runUtilityGeneration = async (
  instance: LLMModule,
  messages: ExecutorchMessage[],
  model: Model | null
): Promise<string> => {
  utilityGenerating = true;
  suppressUtilityStreaming = true;
  try {
    const prepared = model?.thinking ? withNoThink(messages) : messages;
    if (model) {
      instance.configure({
        generationConfig: getGenerationConfigForModel(model, true),
      });
    }
    const result = await instance.generate(prepared);
    reportPromptEstimateAccuracy(prepared, instance, 'utility');
    return typeof result === 'string' ? result : '';
  } catch (error) {
    console.warn('generateUtility failed', error);
    return '';
  } finally {
    if (model) {
      instance.configure({
        generationConfig: getGenerationConfigForModel(model),
      });
    }
    suppressUtilityStreaming = false;
    utilityGenerating = false;
  }
};

const describeGenerationFailure = (): string =>
  'The model returned an empty response';

const NUDGE_TIME_BUDGET_MS = 40_000;

const digestForChat = (get: () => LLMStore, chatId: number): string | null =>
  get().activeChatDigestChatId === chatId ? get().activeChatDigest : null;

const reportPromptEstimateAccuracy = (
  messages: ExecutorchMessage[],
  instance: { getPromptTokensCount?: () => number },
  role: 'chat' | 'utility' = 'chat'
): void => {
  if (!__DEV__ || typeof instance.getPromptTokensCount !== 'function') {
    return;
  }
  const actual = instance.getPromptTokensCount();
  if (!actual) return;
  const assembled = messages
    .map((message) =>
      typeof message.content === 'string'
        ? message.content
        : JSON.stringify(message.content)
    )
    .join(' ');
  const estimated = estimatePromptTokens(assembled);
  console.log(
    '[prompt-tokens]',
    JSON.stringify({
      role,
      estimated,
      actual,
      ratio: +(estimated / actual).toFixed(3),
      chars: assembled.length,
    })
  );
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

  reportPromptEstimateAccuracy(messages, llmInstance);

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
  isRefining: false,
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
  activeChatDigest: null,
  activeChatDigestChatId: null,
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
      if (!useWebSearchStore.getState().isSearchingWeb) {
        useWebSearchStore.getState().resetTrace();
      }
      const [messageHistory, digest] = await Promise.all([
        getChatMessages(db, chatId),
        getChatDigest(db, chatId),
      ]);
      set({
        activeChatId: chatId,
        activeChatMessages: generatingHere
          ? [
              ...messageHistory,
              {
                ...buildAssistantPlaceholder(chatId, get().model),
                content: streamedSoFar,
              },
            ]
          : messageHistory,
        activeChatDigest: digest,
        activeChatDigestChatId: chatId,
      });
    } else {
      set({
        activeChatId: null,
        activeChatMessages: [],
        activeChatDigest: null,
        activeChatDigestChatId: null,
      });
    }
  },

  loadModel: async (model, hardReload: boolean = false) => {
    const { model: currentModel } = get();
    if (model.id === currentModel?.id && llmInstance && !hardReload) {
      return;
    }
    const result = modelLoadChain.then(async () => {
      const network = model.isDownloaded
        ? null
        : await NetInfo.fetch().catch(() => null);
      if (network?.isConnected === false) {
        Toast.show({
          type: 'defaultToast',
          text1: 'Model cannot be loaded without internet connection.',
        });
        return;
      }
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
    const { db, model: selectedModel, activeChatMessages } = get();
    if (!db || !selectedModel) {
      console.warn('LLM not ready or DB not set');
      return false;
    }
    let currentModel = selectedModel;
    if (get().isProcessingPrompt || get().isGenerating) {
      console.warn('A turn is already in flight, rejecting the send');
      return false;
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
    const markGenerationFailed = (
      error: unknown,
      {
        showToUser = true,
        unload = showToUser,
      }: { showToUser?: boolean; unload?: boolean } = {}
    ) => {
      if (unload) unloadLLM();
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

    await modelLoadChain;
    await utilityChain;
    const readyModel = get().model;
    if (!get().isProcessingPrompt || !readyModel) {
      markGenerationFailed(new Error('Stopped while waiting for the model'), {
        showToUser: false,
      });
      return true;
    }
    if (readyModel.id !== currentModel.id) {
      currentModel = readyModel;
      assistantPlaceholder.modelName = readyModel.modelName;
      set((state) => ({
        activeChatMessages: state.activeChatMessages.map((msg) =>
          msg.id === -1 && msg.role === 'assistant' && msg.chatId === chatId
            ? { ...msg, modelName: readyModel.modelName }
            : msg
        ),
      }));
    }

    const abortController = new AbortController();
    sendAbortController = abortController;
    const stillOurs = () => sendAbortController === abortController;

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

      const built = await buildSources(abortController.signal);
      const {
        context,
        sourceDocuments,
        preferredSourceDocuments,
        webIntent,
        webIntentKind,
        webSubQueries,
        webWeak,
        webSearchFailed,
      } = built;

      if (!get().isProcessingPrompt) {
        updateChatStateForGeneration(set, 'failed');
        return true;
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
        return true;
      }

      await waitForSettingsHydration();

      const messagesWithSystemPrompt = prepareMessagesForLLM(
        get().activeChatMessages,
        context,
        settings,
        currentModel,
        {
          customSystemPrompt: useSettingsStore.getState().customSystemPrompt,
          preferredSourceDocuments: preferredSourceDocuments,
          sourceDocuments: sourceDocuments,
          budgetScale: 1,
          webIntent: webIntent,
          webIntentKind: webIntentKind,
          webSubQueries: webSubQueries,
          webWeak: webWeak,
          webSearchFailed: webSearchFailed,
          digest: digestForChat(get, chatId) ?? undefined,
        }
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
      const generationStartedAt = performance.now();
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
          {
            customSystemPrompt: useSettingsStore.getState().customSystemPrompt,
            preferredSourceDocuments: preferredSourceDocuments,
            sourceDocuments: sourceDocuments,
            budgetScale: 0.5,
            webIntent: webIntent,
            webSubQueries: webSubQueries,
            webWeak: webWeak,
            webSearchFailed: webSearchFailed,
            digest: digestForChat(get, chatId) ?? undefined,
          }
        );
        generation = await generateLLMResponse(effectivePrepared, get);
      }
      const { response: rawResponse } = generation;
      let responsePerformance = generation.performance;
      let finalResponse = rawResponse
        ? tidyVisibleAnswer(rawResponse)
        : rawResponse;
      const currentQuestion = get().activeChatMessages.findLast(
        (msg) => msg.role === 'user'
      )?.content;
      const priorAnswerText = get()
        .activeChatMessages.slice(0, -1)
        .findLast((msg) => msg.role === 'assistant')?.content;
      const promptContext = sourcesBlockOf(
        ((last) =>
          typeof last?.content === 'string'
            ? last.content
            : JSON.stringify(last?.content ?? ''))(effectivePrepared.at(-1))
      );

      let nudged = false;
      const answerRetries: AnswerRetry[] = [];

      const questionLanguage = detectQuestionLanguage(currentQuestion ?? '');
      const continuedRetry = (prompt: string): ExecutorchMessage[] => [
        ...effectivePrepared,
        { role: 'assistant', content: finalResponse as string },
        {
          role: 'user',
          content: prompt + answerLanguageAnchor(questionLanguage),
        },
      ];
      const focusedRetry = (lines: string[]): ExecutorchMessage[] => [
        {
          role: 'system',
          content: focusedRetrySystemPrompt(questionLanguage),
        },
        {
          role: 'user',
          content:
            focusedEvidencePrompt(currentQuestion ?? '', lines) +
            answerLanguageAnchor(questionLanguage),
        },
      ];
      const evidenceRetry = (prompt: string): ExecutorchMessage[] => {
        const lines = evidenceLinesFor(currentQuestion, promptContext);
        return lines.length > 0 ? focusedRetry(lines) : continuedRetry(prompt);
      };

      const nudgeOnce = async (
        reason: string,
        messages: ExecutorchMessage[],
        stillBroken: (retried: string) => boolean,
        preserveDetail = false
      ): Promise<void> => {
        nudged = true;
        if (performance.now() - generationStartedAt > NUDGE_TIME_BUDGET_MS) {
          console.warn(`${reason}; skipped, the turn is over its time budget`);
          return;
        }
        console.warn(reason);
        suppressUtilityStreaming = true;
        set({ isRefining: true });
        let retryGeneration: Awaited<ReturnType<typeof generateLLMResponse>>;
        try {
          retryGeneration = await generateLLMResponse(messages, get);
        } finally {
          suppressUtilityStreaming = false;
        }
        const retried = retryGeneration.response
          ? tidyVisibleAnswer(retryGeneration.response)
          : retryGeneration.response;
        if (!retried?.trim() || !get().isGenerating || stillBroken(retried)) {
          answerRetries.push({
            reason,
            raw: retryGeneration.response ?? null,
            accepted: false,
          });
          return;
        }
        if (
          preserveDetail &&
          typeof finalResponse === 'string' &&
          retryDropsGroundedDetail(finalResponse, retried)
        ) {
          console.warn(
            `${reason}; kept the first answer, the retry was thinner`
          );
          answerRetries.push({
            reason,
            raw: retryGeneration.response ?? null,
            accepted: false,
          });
          return;
        }
        answerRetries.push({
          reason,
          raw: retryGeneration.response ?? null,
          accepted: true,
        });
        finalResponse = retried;
      };

      if (
        get().isGenerating &&
        finalResponse &&
        isWrongLanguageAnswer(finalResponse, currentQuestion)
      ) {
        await nudgeOnce(
          'Answer in the wrong language, retrying once with a nudge',
          continuedRetry(WRONG_LANGUAGE_RETRY_PROMPT),
          (retried) => isWrongLanguageAnswer(retried, currentQuestion)
        );
      }

      if (
        !nudged &&
        get().isGenerating &&
        finalResponse &&
        isQuestionEchoAnswer(finalResponse, currentQuestion) &&
        !isWrongLanguageAnswer(finalResponse, currentQuestion)
      ) {
        await nudgeOnce(
          'Question echoed back, retrying once with a nudge',
          continuedRetry(QUESTION_ECHO_RETRY_PROMPT),
          (retried) => isQuestionEchoAnswer(retried, currentQuestion)
        );
        if (
          finalResponse &&
          isQuestionEchoAnswer(finalResponse, currentQuestion)
        ) {
          finalResponse = noAnswerFallback(currentQuestion);
        }
      }

      if (
        !nudged &&
        get().isGenerating &&
        finalResponse &&
        claimsMissingEvidenceItHas(
          finalResponse,
          currentQuestion,
          promptContext,
          webIntentKind
        )
      ) {
        await nudgeOnce(
          'Answer claims the sources are silent while they hold a figure, retrying once',
          evidenceRetry(EVIDENCE_PRESENT_RETRY_PROMPT),
          (retried) =>
            claimsMissingEvidenceItHas(
              retried,
              currentQuestion,
              promptContext,
              webIntentKind
            ) || isWrongLanguageAnswer(retried, currentQuestion),
          true
        );
      }

      const ignoresEvidence = (text: string): boolean =>
        answerUsesNoRetrievedEvidence(text, currentQuestion, promptContext);
      const buriesFigure = (text: string): boolean =>
        buriesFigureContextOffers(
          text,
          currentQuestion,
          promptContext,
          webIntentKind
        );
      if (
        !nudged &&
        get().isGenerating &&
        finalResponse &&
        (ignoresEvidence(finalResponse) || buriesFigure(finalResponse))
      ) {
        const draft = finalResponse;
        const retryStatesWhatDraftLacks = (retried: string): boolean =>
          answerStatesFigure(retried, currentQuestion) &&
          !answerStatesFigure(draft, currentQuestion);
        await nudgeOnce(
          ignoresEvidence(finalResponse)
            ? 'Answer uses none of the evidence the sources carry, retrying once'
            : 'Answer buries the figure the sources offer, retrying once',
          evidenceRetry(SOURCES_COVER_TOPIC_RETRY_PROMPT),
          (retried) =>
            ((ignoresEvidence(retried) || buriesFigure(retried)) &&
              !retryStatesWhatDraftLacks(retried)) ||
            isWrongLanguageAnswer(retried, currentQuestion),
          true
        );
      }

      if (
        !nudged &&
        get().isGenerating &&
        finalResponse &&
        isCircularNonAnswer(finalResponse) &&
        !isWrongLanguageAnswer(finalResponse, currentQuestion)
      ) {
        await nudgeOnce(
          'Circular non-answer, retrying once with a nudge',
          continuedRetry(CIRCULAR_ANSWER_RETRY_PROMPT),
          isCircularNonAnswer
        );
      }

      const missingAspects = finalResponse
        ? aspectsMissingFromAnswer(finalResponse, webSubQueries, promptContext)
        : [];
      if (
        !nudged &&
        get().isGenerating &&
        finalResponse &&
        missingAspects.length > 0 &&
        !isDanglingListAnswer(finalResponse)
      ) {
        await nudgeOnce(
          'Answer skips an aspect the sources cover, retrying once with a nudge',
          continuedRetry(aspectCoverageRetryPrompt(missingAspects)),
          (retried) =>
            aspectsMissingFromAnswer(retried, webSubQueries, promptContext)
              .length > 0,
          true
        );
      }

      if (
        !nudged &&
        get().isGenerating &&
        finalResponse &&
        isDanglingListAnswer(finalResponse) &&
        !isQuestionEchoAnswer(finalResponse, currentQuestion) &&
        !isWrongLanguageAnswer(finalResponse, currentQuestion)
      ) {
        console.warn(
          'Dangling list answer, retrying once with a continuation nudge'
        );
        updateChatStateForGeneration(set, 'generating');
        const continuationPrompt =
          DANGLING_LIST_CONTINUATION_PROMPT +
          answerLanguageAnchor(detectQuestionLanguage(currentQuestion ?? ''));
        const continuationGeneration = await generateLLMResponse(
          [
            ...effectivePrepared,
            { role: 'assistant', content: finalResponse },
            { role: 'user', content: continuationPrompt },
          ],
          get
        );
        const continuationResponse = continuationGeneration.response
          ? truncateAtRepeatedClause(
              normalizeModelText(continuationGeneration.response)
            )
          : continuationGeneration.response;
        answerRetries.push({
          reason: 'Dangling list answer, continuation nudge',
          raw: continuationGeneration.response ?? null,
          accepted: !!continuationResponse?.trim(),
        });
        if (continuationResponse?.trim()) {
          finalResponse = `${finalResponse}\n${continuationResponse.trim()}`;
          responsePerformance = continuationGeneration.performance;
        }
      }

      void recordAnswerTrace({
        shape: {
          generating: get().isGenerating,
          dangling: !!finalResponse && isDanglingListAnswer(finalResponse),
          circular: !!finalResponse && isCircularNonAnswer(finalResponse),
          nudged,
        },
        question: currentQuestion ?? '',
        raw: rawResponse ?? '',
        tidied: rawResponse ? tidyVisibleAnswer(rawResponse) : '',
        retries: answerRetries,
        final: finalResponse ?? '',
        systemPromptChars: ((first) =>
          typeof first?.content === 'string' ? first.content.length : 0)(
          effectivePrepared[0]
        ),
      });

      if (finalResponse && stripThinkBlocks(finalResponse).trim()) {
        const humanizedResponse = humanizeSourceReferences(
          stripSourceLabels(
            stripEchoedQuestionPrefix(finalResponse, currentQuestion)
          ),
          sourceDocuments ?? []
        );
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
          humanizedResponse,
          preferredSourceDocuments ?? [],
          sourcesPresentInContext(effectiveContent),
          currentQuestion
        );
        const groundingCaveats = context.some((chunk) => chunk.trim())
          ? detectGroundingCaveats(
              humanizedResponse,
              currentQuestion,
              effectiveContent,
              priorAnswerText
            )
          : [];
        const stoppedByUser = !get().isGenerating;
        const assistantMessageId = await persistMessage(db, {
          ...assistantPlaceholder,
          content: humanizedResponse,
          sourceDocuments: citedSourceDocuments,
          groundingCaveats,
          tokensPerSecond: responsePerformance.tokensPerSecond,
          timeToFirstToken: responsePerformance.timeToFirstToken,
        });

        if (!stillOurs()) {
          failedGenerationRequest = null;
        } else if (get().activeChatId === chatId) {
          updateChatStateForGeneration(set, 'complete', {
            assistantMessage: {
              ...assistantPlaceholder,
              id: assistantMessageId,
              content: humanizedResponse,
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

        if (!stoppedByUser) {
          const previousDigest = digestForChat(get, chatId);
          updateConversationDigest(
            (messages) => get().generateUtility(messages),
            previousDigest,
            currentQuestion ?? '',
            humanizedResponse
          ).then((digest) => {
            void setChatDigest(db, chatId, digest);
            if (get().activeChatId === chatId) {
              set({
                activeChatDigest: digest,
                activeChatDigestChatId: chatId,
              });
            }
          });
        }
      } else if (stillOurs()) {
        const wasInterrupted = !get().isGenerating && !get().isProcessingPrompt;
        markGenerationFailed(new Error(describeGenerationFailure()), {
          unload: false,
          showToUser: !wasInterrupted,
        });
      }
    } catch (e) {
      if (stillOurs()) {
        const wasInterrupted = !get().isGenerating && !get().isProcessingPrompt;
        markGenerationFailed(e, { showToUser: !wasInterrupted });
      }
    } finally {
      if (stillOurs()) sendAbortController = null;
    }
    return true;
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

  generateUtility: (messages) => {
    if (!llmInstance || get().isLoading || utilityGenerating) {
      return Promise.resolve('');
    }
    const run = runUtilityGeneration(llmInstance, messages, get().model);
    utilityChain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  },

  interrupt: () => {
    sendAbortController?.abort();
    const state = get();
    if ((state.isGenerating || utilityGenerating) && llmInstance) {
      llmInstance.interrupt();
    }

    if (state.isProcessingPrompt && !state.isGenerating) {
      useWebSearchStore.getState().setSearchingWeb(false);
      updateChatStateForGeneration(set, 'failed');
      return;
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
