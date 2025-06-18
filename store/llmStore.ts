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
    chatId: number
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
            set({ firstTokenTime: performance.now() });
          }
        }
      },
    });

    set({ model, isLoading: false });
  },

  sendChatMessage: async (
    messages: Message[],
    newMessage: string,
    chatId: number
  ) => {
    const { isGenerating, db, model, isLoading } = get();
    if (isGenerating || !db || model === null || isLoading) return;

    try {
      const userMessageId = await persistMessage(db, {
        chatId: chatId,
        role: 'user',
        content: newMessage,
        timeToFirstToken: 0,
        tokensPerSecond: 0,
      });

      messages.push({
        role: 'user',
        content: newMessage,
        chatId: chatId,
        timestamp: Date.now(),
        id: userMessageId,
      });

      const chatSettings = await getChatSettings(db, chatId);
      const systemPrompt = chatSettings.systemPrompt;
      const contextWindow = chatSettings.contextWindow;

      const messagesWithSystemPrompt: ExecutorchMessage[] = [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-contextWindow),
      ];

      messages.push({
        role: 'assistant',
        content: '',
        modelName: model.modelName,
        chatId: chatId,
        timestamp: Date.now(),
        id: -1,
      });

      set({
        isGenerating: true,
        response: '',
        activeChatMessages: messages,
        tokenCount: 0,
        activeChatId: chatId,
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
          modelName: model.modelName,
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
      set({ isGenerating: false });
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
      set({ isGenerating: false });
    }
  },
  interrupt: () => {
    if (get().isGenerating) {
      LLMModule.interrupt();
    }
  },
}));
