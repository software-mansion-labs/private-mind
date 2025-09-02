import { create } from 'zustand';
import { LLMModule } from 'react-native-executorch';
import { Model } from '../database/modelRepository';
import { SQLiteDatabase } from 'expo-sqlite';
import {
  ChatSettings,
  getChatMessages,
  Message,
  persistMessage,
} from '../database/chatRepository';
import DeviceInfo from 'react-native-device-info';
import { BENCHMARK_PROMPT } from '../constants/default-benchmark';
import { BenchmarkResultPerformanceNumbers } from '../database/benchmarkRepository';
import { type Message as ExecutorchMessage } from 'react-native-executorch';
import { Platform } from 'react-native';
import { Feedback } from '../utils/Feedback';

interface LLMStore {
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

  setDB: (db: SQLiteDatabase) => void;
  loadModel: (model: Model, hardReload?: boolean) => Promise<void>;
  setActiveChatId: (chatId: number | null) => Promise<void>;
  sendChatMessage: (
    newMessage: string,
    chatId: number,
    context: string[],
    settings: ChatSettings
  ) => Promise<void>;
  runBenchmark: () => Promise<BenchmarkResultPerformanceNumbers | undefined>;
  interrupt: () => void;
  sendEventMessage: (chatId: number, message: string) => Promise<void>;
  refreshActiveChatMessages: () => Promise<void>;
}

const llmInstance = new LLMModule();

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
  let trackerId: number;
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

const prepareMessagesForLLM = (
  activeChatMessages: Message[],
  context: string[],
  settings: ChatSettings,
  model: Model
): ExecutorchMessage[] => {
  let systemPrompt = settings.systemPrompt;

  if (context.length > 0) {
    const contextInstructions = `IMPORTANT CONTEXT INFORMATION: You have access to relevant information from the user's document sources provided in <context></context> tags. Use this context to provide accurate, well-informed responses. Always prioritize information from the provided context when it's relevant to the user's question. Instructions for using context:
    - The context information is provided within <context></context> tags in the user's message
    - Refer to the context information when answering questions
    - If the context directly addresses the user's question, use that information as the primary basis for your response
    - If information from context conflicts with your general knowledge, prioritize the context
    - If the context doesn't contain relevant information for the question, you may use your general knowledge but mention this limitation
    - When citing information from context, you can reference it naturally without formal citations`;

    systemPrompt = systemPrompt + contextInstructions;
  }

  const filteredMessages: ExecutorchMessage[] = activeChatMessages.reduce(
    (acc: ExecutorchMessage[], msg) => {
      if (msg.role !== 'event') {
        acc.push({ role: msg.role, content: msg.content });
      }
      return acc;
    },
    []
  );

  const contextWindow = settings.contextWindow;
  const messagesWithSystemPrompt: ExecutorchMessage[] = [
    { role: 'system', content: systemPrompt },
    ...filteredMessages.slice(-contextWindow, -1),
  ];

  if (settings.thinkingEnabled) {
    messagesWithSystemPrompt.at(-1)!.content += ' /think';
  } else if (model.thinking) {
    messagesWithSystemPrompt.at(-1)!.content += ' /no_think';
  }

  if (context.length > 0) {
    messagesWithSystemPrompt.at(-1)!.content = `<context>${context.join(
      ' '
    )}</context>
        ${messagesWithSystemPrompt.at(-1)!.content}
        `;
  }

  return messagesWithSystemPrompt;
};

const waitForModelLoad = async (get: () => LLMStore): Promise<void> => {
  if (get().isLoading) {
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (!get().isLoading || !get().isProcessingPrompt) {
          clearInterval(interval);
          resolve(null);
        }
      }, 100);
    });
  }
};

const updateChatStateForGeneration = (
  set: (
    partial: Partial<LLMStore> | ((state: LLMStore) => Partial<LLMStore>)
  ) => void,
  phase: 'start' | 'generating' | 'complete',
  data?: {
    chatId?: number;
    activeChatMessages?: Message[];
    userMessage?: Message;
    assistantPlaceholder?: Message;
    timeToFirstToken?: number;
    tokensPerSecond?: number;
  }
) => {
  switch (phase) {
    case 'start':
      set({
        isProcessingPrompt: true,
        generatingForChatId: data?.chatId,
        activeChatMessages: data?.activeChatMessages,
      });
      break;
    case 'generating':
      set({
        isGenerating: true,
        performance: {
          tokenCount: 0,
          firstTokenTime: 0,
        },
      });
      break;
    case 'complete':
      if (
        data?.timeToFirstToken !== undefined &&
        data?.tokensPerSecond !== undefined
      ) {
        set((state) => ({
          activeChatMessages: state.activeChatMessages.map((msg, index) =>
            index === state.activeChatMessages.length - 1
              ? {
                  ...msg,
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
  }
};

const generateLLMResponse = async (
  messages: ExecutorchMessage[],
  get: () => LLMStore
): Promise<{
  response: string | null;
  performance: { timeToFirstToken: number; tokensPerSecond: number };
}> => {
  const startTime = performance.now();
  const finalResponse = await llmInstance.generate(messages);
  const endTime = performance.now();

  if (finalResponse) {
    const { timeToFirstToken, tokensPerSecond } = calculatePerformanceMetrics(
      startTime,
      endTime,
      get().performance.firstTokenTime,
      get().performance.tokenCount
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

  setDB: (db) => set({ db }),

  setActiveChatId: async (chatId) => {
    const db = get().db;
    if (!db) {
      console.warn('Database not initialized');
      return;
    }
    //Once the user selects a chat room, we load the messages for that chat and set it as the active chat.
    if (chatId !== null) {
      const messageHistory = await getChatMessages(db, chatId);
      set({ activeChatId: chatId, activeChatMessages: messageHistory });
    } else {
      set({ activeChatId: null, activeChatMessages: [] });
    }
  },

  loadModel: async (model, hardReload: boolean = false) => {
    const { model: currentModel } = get();
    if (model.id === currentModel?.id && !hardReload) {
      return;
    }
    if (currentModel) {
      llmInstance.delete();
    }

    set({ isLoading: true, model: model });

    try {
      await llmInstance.load({
        modelSource: model.modelPath,
        tokenizerSource: model.tokenizerPath,
        tokenizerConfigSource: model.tokenizerConfigPath,
      });

      llmInstance.setTokenCallback({
        tokenCallback: (token) => {
          const isFirstToken = get().performance.tokenCount === 0;
          if (isFirstToken && !get().isBenchmarking) {
            Feedback.success();
          }
          set({
            isProcessingPrompt: false,
            performance: {
              tokenCount: get().performance.tokenCount + 1,
              firstTokenTime: isFirstToken
                ? performance.now()
                : get().performance.firstTokenTime,
            },
          });
          /* This check ensures that after we leave the chat,
          new messags history won't be overwritten by token send after interrupt.
          */
          if (get().generatingForChatId === get().activeChatId) {
            set({
              activeChatMessages: get().activeChatMessages.map((msg, index) =>
                index === get().activeChatMessages.length - 1
                  ? { ...msg, content: msg.content + token }
                  : msg
              ),
            });
          }
        },
      });

      set({ isLoading: false });
    } catch (e) {
      console.error('Error loading model:', e);
      set({ isLoading: false, model: null });
    }
  },

  sendChatMessage: async (newMessage, chatId, context, settings) => {
    const { db, model: currentModel, activeChatMessages } = get();
    if (!db || !currentModel) {
      console.warn('LLM not ready or DB not set');
      return;
    }

    try {
      const userMessage: Omit<Message, 'id'> = {
        role: 'user',
        content: newMessage,
        chatId,
        timestamp: Date.now(),
      };
      const assistantPlaceholder: Message = {
        role: 'assistant',
        content: '',
        modelName: currentModel.modelName,
        chatId: chatId,
        timestamp: Date.now(),
        id: -1,
      };

      const userMessageId = await persistMessage(db, userMessage);
      const updatedChatMessages = [
        ...activeChatMessages,
        { ...userMessage, id: userMessageId },
        assistantPlaceholder,
      ];

      updateChatStateForGeneration(set, 'start', {
        chatId,
        activeChatMessages: updatedChatMessages,
      });

      const messagesWithSystemPrompt = prepareMessagesForLLM(
        get().activeChatMessages,
        context,
        settings,
        currentModel
      );

      await waitForModelLoad(get);

      // Check if user interrupted during model loading
      if (!get().isProcessingPrompt) {
        return;
      }

      // Set generation state and generate response
      updateChatStateForGeneration(set, 'generating');
      const { response: finalResponse, performance: responsePerformance } =
        await generateLLMResponse(messagesWithSystemPrompt, get);

      // Handle successful response
      if (finalResponse) {
        await persistMessage(db, {
          ...assistantPlaceholder,
          content: finalResponse,
          tokensPerSecond: responsePerformance.tokensPerSecond,
          timeToFirstToken: responsePerformance.timeToFirstToken,
        });

        if (get().activeChatId === chatId) {
          updateChatStateForGeneration(set, 'complete', {
            timeToFirstToken: responsePerformance.timeToFirstToken,
            tokensPerSecond: responsePerformance.tokensPerSecond,
          });
        } else {
          updateChatStateForGeneration(set, 'complete');
        }
      } else {
        updateChatStateForGeneration(set, 'complete');
      }
    } catch (e) {
      console.error('Chat sendMessage failed', e);
      updateChatStateForGeneration(set, 'complete');
    }
  },

  runBenchmark: async () => {
    let runPeakMemory = 0;
    const memoryTracker = createMemoryTracker((usedMemory) => {
      if (usedMemory > runPeakMemory) runPeakMemory = usedMemory;
    });

    try {
      set({
        isGenerating: true,
        performance: { tokenCount: 0, firstTokenTime: 0 },
        isBenchmarking: true,
      });
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

      const { tokenCount, firstTokenTime } = get().performance;
      const { totalTime, timeToFirstToken, tokensPerSecond } =
        calculatePerformanceMetrics(
          startTime,
          endTime,
          firstTokenTime,
          tokenCount
        );

      return {
        totalTime,
        timeToFirstToken,
        tokensPerSecond,
        tokensGenerated: tokenCount,
        peakMemory: runPeakMemory,
      };
    } catch (e) {
      memoryTracker.stop();
    } finally {
      set({ isGenerating: false, isBenchmarking: false });
    }
  },

  interrupt: () => {
    if (get().isGenerating) {
      llmInstance.interrupt();
      set({ isGenerating: false, isProcessingPrompt: false });
    } else if (get().isProcessingPrompt) {
      set({ isProcessingPrompt: false });
    }
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

  refreshActiveChatMessages: async () => {
    const { db, activeChatId } = get();
    if (!db || !activeChatId) return;

    const messageHistory = await getChatMessages(db, activeChatId);
    set({ activeChatMessages: messageHistory });
  },
}));
