import { create } from 'zustand';
import { LLMModule } from 'react-native-executorch';
import { Model } from '../database/modelRepository';
import { SQLiteDatabase } from 'expo-sqlite';
import {
  getChatSettings,
  persistMessage,
  Message,
} from '../database/chatRepository';
import DeviceInfo from 'react-native-device-info';
import { BENCHMARK_PROMPT } from '../constants/default-benchmark';
import {
  BenchmarkResult,
  insertBenchmark,
} from '../database/benchmarkRepository';
import { type Message as ExecutorchMessage } from 'react-native-executorch';

interface LLMStore {
  isLoading: boolean;
  isGenerating: boolean;
  db: SQLiteDatabase | null;
  activeChatId: number | null;
  activeChatMessages: Message[];
  response: string;
  model: Model | null;
  tokenCount: number;
  firstTokenTime: number;

  sendChatMessage: (messages: Message[], newMessage: string) => Promise<void>;
  setDB: (db: SQLiteDatabase) => void;
  loadModel: (model: Model) => Promise<void>;
  unloadModel: () => void;
  setActiveChatId: (chatId: number) => void;
  runBenchmark: () => Promise<BenchmarkResult>;
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
  activeChatId: null,
  activeChatMessages: [],
  db: null,
  response: '',
  model: null,
  tokenCount: 0,
  firstTokenTime: 0,

  setDB: (db) => set({ db }),
  setActiveChatId: (chatId) =>
    set({
      activeChatId: chatId,
      activeChatMessages: [],
    }),

  loadModel: async (model: Model) => {
    if (get().model !== null) {
      LLMModule.delete();
    }
    set({ isLoading: true });
    await LLMModule.load({
      modelSource: model.modelPath,
      tokenizerSource: model.tokenizerPath,
      tokenizerConfigSource: model.tokenizerConfigPath,
      responseCallback: (response) => {
        const messages = get().activeChatMessages;
        messages[messages.length - 1]
          ? (messages[messages.length - 1].content = response)
          : null;
        set({ response, activeChatMessages: messages });
        if (response != '') {
          set({ tokenCount: get().tokenCount + 1 });
          if (get().tokenCount === 1) {
            set({ firstTokenTime: performance.now() });
          }
        }
      },
    });

    set({ model, isLoading: false });
  },

  unloadModel: () => {
    if (get().model !== null) {
      LLMModule.delete();
      set({ model: null, response: '', tokenCount: 0, firstTokenTime: 0 });
    }
  },

  sendChatMessage: async (messages: Message[], newMessage: string) => {
    const { isGenerating, db, model, isLoading, activeChatId } = get();
    if (isGenerating || !db || model === null || isLoading || !activeChatId)
      return;

    try {
      const userMessageId = await persistMessage(db, {
        chatId: activeChatId,
        role: 'user',
        content: newMessage,
        timeToFirstToken: 0,
        tokensPerSecond: 0,
      });

      messages.push({
        role: 'user',
        content: newMessage,
        chatId: activeChatId,
        timestamp: Date.now(),
        id: userMessageId,
      });

      const chatSettings = await getChatSettings(db, activeChatId);

      const systemPrompt = chatSettings.systemPrompt;
      const contextWindow = chatSettings.contextWindow;

      const messagesWithSystemPrompt: ExecutorchMessage[] = [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-contextWindow),
      ];

      messages.push({
        role: 'assistant',
        content: '',
        modelName: model.id,
        chatId: activeChatId,
        timestamp: Date.now(),
        id: -1,
      });

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
          modelName: model.id,
          content: generatedResponse,
          tokensPerSecond: tokensPerSecond,
          timeToFirstToken: timeToFirstToken,
          chatId: activeChatId,
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

  runBenchmark: async () => {
    const { isGenerating, db, model, isLoading } = get();

    const iterations = 3;

    let avgTotalTime = 0;
    let avgTTFT = 0;
    let avgTPS = 0;
    let avgTokens = 0;
    let peakMemory = 0;

    if (isGenerating || !db || model === null || isLoading)
      return {
        id: -1,
        modelId: '',
        timeToFirstToken: 0,
        tokensPerSecond: 0,
        totalTime: 0,
        tokensGenerated: 0,
        peakMemory: 0,
      };

    for (let i = 1; i <= iterations; i++) {
      set({ tokenCount: 0, firstTokenTime: 0, isGenerating: true });

      let runPeakMemory = 0;
      const memoryUsageTracker = setInterval(async () => {
        try {
          const usedMemory = await DeviceInfo.getUsedMemory();
          if (usedMemory > runPeakMemory) {
            runPeakMemory = usedMemory;
          }
        } catch (e) {
          console.warn('Unable to read memory:', e);
        }
      }, 3000);

      const startTime = performance.now();

      try {
        await LLMModule.generate([
          {
            role: 'system',
            content:
              'You are helpful assistant. Do exactly what user tells you.',
          },
          { role: 'user', content: BENCHMARK_PROMPT },
        ]);
        const endTime = performance.now();

        clearInterval(memoryUsageTracker);

        const count = get().tokenCount;
        const firstTokenTime = get().firstTokenTime;

        const { totalTime, timeToFirstToken, tokensPerSecond } =
          calculatePerformanceMetrics(
            startTime,
            endTime,
            firstTokenTime,
            count
          );

        avgTotalTime += (totalTime - avgTotalTime) / i;
        avgTTFT += (timeToFirstToken - avgTTFT) / i;
        avgTPS += (tokensPerSecond - avgTPS) / i;
        avgTokens += (count - avgTokens) / i;

        peakMemory = Math.max(peakMemory, runPeakMemory);
      } catch (e) {
        console.error(`Benchmark iteration ${i} failed`, e);
      } finally {
        set({ isGenerating: false });
      }
    }

    const result = {
      modelId: model.id,
      timeToFirstToken: avgTTFT,
      tokensPerSecond: avgTPS,
      totalTime: avgTotalTime,
      tokensGenerated: avgTokens,
      peakMemory: peakMemory / 1024 / 1024 / 1024,
    };

    const benchmarkId = await insertBenchmark(db, result);

    return {
      ...result,
      id: benchmarkId,
    };
  },
  interrupt: () => LLMModule.interrupt(),
}));
