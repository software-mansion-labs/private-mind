import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface ModelContextCapacityStore {
  lastKnown: Record<number, number>;
  remember: (modelId: number, tokens: number) => void;
  forgetAll: () => void;
}

export const useModelContextCapacityStore = create<ModelContextCapacityStore>()(
  persist(
    (set, get) => ({
      lastKnown: {},
      remember: (modelId, tokens) => {
        if (get().lastKnown[modelId] === tokens) return;
        set({ lastKnown: { ...get().lastKnown, [modelId]: tokens } });
      },
      forgetAll: () => set({ lastKnown: {} }),
    }),
    {
      name: 'model-context-capacity',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ lastKnown }) => ({ lastKnown }),
    }
  )
);
