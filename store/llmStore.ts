import { create } from 'zustand';
import { LLMModule } from 'react-native-executorch';
import { Model } from '../database/modelRepository';
import { SQLiteDatabase } from 'expo-sqlite';
import {
  getChatMessages,
  getChatSettings,
  Message,
  persistMessage,
} from '../database/chatRepository';
import DeviceInfo from 'react-native-device-info';
import { BENCHMARK_PROMPT } from '../constants/default-benchmark';
import { BenchmarkResultPerformanceNumbers } from '../database/benchmarkRepository';
import { type Message as ExecutorchMessage } from 'react-native-executorch';
import { Platform } from 'react-native';

interface LLMStore {
  isLoading: boolean;
  isGenerating: boolean;
  isProcessingPrompt: boolean;
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
  setActiveChatId: (chatId: number) => Promise<void>;
  sendChatMessage: (newMessage: string, chatId: number) => Promise<void>;
  runBenchmark: () => Promise<BenchmarkResultPerformanceNumbers | undefined>;
  interrupt: () => void;
}

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
  let trackerId: NodeJS.Timeout;
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

export const useLLMStore = create<LLMStore>((set, get) => ({
  isLoading: false,
  isGenerating: false,
  isProcessingPrompt: false,
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

  setActiveChatId: async (chatId: number) => {
    //Once the user selects a chat room, we load the messages for that chat and set it as the active chat.
    const messageHistory = await getChatMessages(get().db!, chatId);
    set({ activeChatId: chatId, activeChatMessages: messageHistory });
  },

  loadModel: async (model, hardReload: boolean = false) => {
    const { model: currentModel } = get();
    if (model.id === currentModel?.id && !hardReload) {
      return;
    }
    if (currentModel) {
      LLMModule.delete();
    }

    set({ isLoading: true, model: model });

    try {
      await LLMModule.load({
        modelSource: model.modelPath,
        tokenizerSource: model.tokenizerPath,
        tokenizerConfigSource: model.tokenizerConfigPath,
        responseCallback: (response) => {
          // The first callback is called with an empty string when we load the model, we ignore it.
          if (response === '') return;
          const isFirstToken = get().performance.tokenCount === 0;
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
                  ? { ...msg, content: response }
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

  sendChatMessage: async (newMessage: string, chatId: number) => {
    const { db, model: currentModel, activeChatMessages } = get();
    if (!db || !currentModel) {
      console.warn('LLM not ready or DB not set');
      return;
    }

    set({
      isProcessingPrompt: true,
      generatingForChatId: chatId,
    });

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
      const userMessageId = await persistMessage(db, {
        ...userMessage,
      });
      set({
        activeChatMessages: [
          ...activeChatMessages,
          { ...userMessage, id: userMessageId },
          assistantPlaceholder,
        ],
      });

      const settings = await getChatSettings(db, chatId);
      const systemPrompt = settings.systemPrompt;
      const contextWindow = settings.contextWindow;
      const messagesWithSystemPrompt: ExecutorchMessage[] = [
        { role: 'system', content: systemPrompt },
        ...get().activeChatMessages.slice(-contextWindow, -1),
      ];
      // Polling to wait for the model to load and display dots until the first token is generated.
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

      // If the user interrupts when the model is loading
      if (!get().isProcessingPrompt) {
        return;
      }

      set({
        isGenerating: true,
        performance: {
          tokenCount: 0,
          firstTokenTime: 0,
        },
      });

      const startTime = performance.now();
      const finalResponse = await LLMModule.generate(messagesWithSystemPrompt);
      const endTime = performance.now();

      if (finalResponse) {
        const { timeToFirstToken, tokensPerSecond } =
          calculatePerformanceMetrics(
            startTime,
            endTime,
            get().performance.firstTokenTime,
            get().performance.tokenCount
          );
        await persistMessage(db, {
          ...assistantPlaceholder,
          content: finalResponse,
          tokensPerSecond,
          timeToFirstToken,
        });
        if (get().activeChatId === chatId) {
          set((state) => ({
            activeChatMessages: state.activeChatMessages.map((msg, index) =>
              index === state.activeChatMessages.length - 1
                ? { ...msg, timeToFirstToken, tokensPerSecond }
                : msg
            ),
          }));
        }
      }
    } catch (e) {
      console.error('Chat sendMessage failed', e);
    } finally {
      set({
        isGenerating: false,
        generatingForChatId: null,
        isProcessingPrompt: false,
      });
    }
  },

  runBenchmark: async () => {
    set({
      performance: { tokenCount: 0, firstTokenTime: 0 },
      isGenerating: true,
    });
    let runPeakMemory = 0;
    const memoryTracker = createMemoryTracker((usedMemory) => {
      if (usedMemory > runPeakMemory) runPeakMemory = usedMemory;
    });

    try {
      set({
        isGenerating: true,
        performance: { tokenCount: 0, firstTokenTime: 0 },
      });
      memoryTracker.start();

      const startTime = performance.now();
      await LLMModule.generate([
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
      console.error(`Benchmark failed`, e);
      memoryTracker.stop();
    } finally {
      set({ isGenerating: false });
    }
  },

  interrupt: () => {
    if (get().isGenerating) {
      LLMModule.interrupt();
    } else if (get().isProcessingPrompt) {
      set({ isProcessingPrompt: false });
    }
  },
}));
