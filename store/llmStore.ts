import { create } from 'zustand';
import { LLMModule } from 'react-native-executorch';
import { Model } from '../database/modelRepository';
import { SQLiteDatabase } from 'expo-sqlite';
import {
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
  response: string;
  model: Model | null;
  tokenCount: number;
  firstTokenTime: number;
  activeChatId: number | null;
  activeChatMessages: Message[];

  sendChatMessage: (
    messages: Message[],
    newMessage: string,
    chatId: number,
    modelName: string
  ) => Promise<void>;
  setDB: (db: SQLiteDatabase) => void;
  loadModel: (model: Model) => Promise<void>;
  runBenchmark: (
    selectedModel: Model
  ) => Promise<BenchmarkResultPerformanceNumbers | undefined>;
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

export const useLLMStore = create<LLMStore>((set, get) => ({
  isLoading: false,
  isGenerating: false,
  isProcessingPrompt: false,
  db: null,
  response: '',
  model: null,
  tokenCount: 0,
  firstTokenTime: 0,
  activeChatId: null,
  activeChatMessages: [],

  setDB: (db) => set({ db }),

  loadModel: async (model) => {
    if (model.id === get().model?.id || get().isLoading) {
      return;
    }
    if (get().model) {
      LLMModule.delete();
    }

    set({ isLoading: true });

    await LLMModule.load({
      modelSource: model.modelPath,
      tokenizerSource: model.tokenizerPath,
      tokenizerConfigSource: model.tokenizerConfigPath,
      responseCallback: (response) => {
        if (response != '') {
          const messages = get().activeChatMessages;
          if (messages[messages.length - 1]) {
            messages[messages.length - 1].content = response;
          }

          set({
            response,
            activeChatMessages: messages,
            tokenCount: get().tokenCount + 1,
          });
          if (get().tokenCount === 1) {
            set({
              firstTokenTime: performance.now(),
              isProcessingPrompt: false,
            });
          }
        }
      },
    });

    set({ model, isLoading: false });
  },

  sendChatMessage: async (
    messages: Message[],
    newMessage: string,
    chatId: number,
    modelName: string
  ) => {
    const { db } = get();
    if (!db) return;
    set({
      isProcessingPrompt: true,
      activeChatId: chatId,
    });
    try {
      const userMessageId = await persistMessage(db, {
        chatId: chatId,
        role: 'user',
        content: newMessage,
        timeToFirstToken: 0,
        tokensPerSecond: 0,
      });

      const userMessage: Message = {
        id: userMessageId,
        chatId,
        role: 'user',
        content: newMessage,
        timestamp: Date.now(),
      };

      const assistantPlaceholder: Message = {
        id: -1,
        chatId,
        role: 'assistant',
        content: '',
        modelName,
        timestamp: Date.now(),
      };

      const updatedMessages = [...messages, userMessage, assistantPlaceholder];
      set({
        activeChatId: chatId,
        activeChatMessages: updatedMessages,
      });
      messages.push({
        role: 'assistant',
        content: '',
        modelName: modelName,
        chatId: chatId,
        timestamp: Date.now(),
        id: -1,
      });

      set({
        activeChatMessages: messages,
      });

      const chatSettings = await getChatSettings(db, chatId);
      const systemPrompt = chatSettings.systemPrompt;
      const contextWindow = chatSettings.contextWindow;

      const messagesWithSystemPrompt: ExecutorchMessage[] = [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-contextWindow),
      ];

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

      if (!get().isProcessingPrompt) {
        messages.pop();
        return;
      }

      set({
        isGenerating: true,
        response: '',
        activeChatMessages: messages,
        tokenCount: 0,
      });

      const startTime = performance.now();
      const generatedResponse = await LLMModule.generate(
        messagesWithSystemPrompt
      );
      const endTime = performance.now();
      const { timeToFirstToken, tokensPerSecond } = calculatePerformanceMetrics(
        startTime,
        endTime,
        get().firstTokenTime,
        get().tokenCount
      );
      if (generatedResponse) {
        await persistMessage(db, {
          role: 'assistant',
          modelName: get().model?.modelName,
          content: generatedResponse,
          tokensPerSecond: tokensPerSecond,
          timeToFirstToken: timeToFirstToken,
          chatId: chatId,
        });

        messages[messages.length - 1].timeToFirstToken = timeToFirstToken;
        messages[messages.length - 1].tokensPerSecond = tokensPerSecond;

        set({
          activeChatMessages: messages,
        });
      }
    } catch (e) {
      console.error('Chat sendMessage failed', e);
    } finally {
      set({ isGenerating: false, isProcessingPrompt: false });
    }
  },

  runBenchmark: async (selectedModel) => {
    set({ tokenCount: 0, firstTokenTime: 0, isGenerating: true });

    let runPeakMemory = 0;
    let memoryUsageTracker: NodeJS.Timeout | undefined;
    if (Platform.OS === 'ios') {
      memoryUsageTracker = setInterval(async () => {
        try {
          const usedMemory = await DeviceInfo.getUsedMemory();
          if (usedMemory > runPeakMemory) {
            runPeakMemory = usedMemory;
          }
        } catch (e) {
          console.warn('Unable to read memory:', e);
        }
      }, 3000);
    }

    try {
      await get().loadModel(selectedModel);

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

      if (Platform.OS === 'ios') clearInterval(memoryUsageTracker);

      const generatedTokens = get().tokenCount;
      const firstTokenTime = get().firstTokenTime;

      const { totalTime, timeToFirstToken, tokensPerSecond } =
        calculatePerformanceMetrics(
          startTime,
          endTime,
          firstTokenTime,
          generatedTokens
        );

      return {
        totalTime,
        timeToFirstToken,
        tokensPerSecond,
        tokensGenerated: generatedTokens,
        peakMemory: Platform.OS === 'ios' ? runPeakMemory : 0,
      };
    } catch (e) {
      console.error(`Benchmark failed`, e);
    } finally {
      set({ isGenerating: false, isProcessingPrompt: false });
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
