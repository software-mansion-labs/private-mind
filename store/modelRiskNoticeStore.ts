import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface ModelRiskNoticeStore {
  dismissedModelIds: number[];
  dismissForModel: (modelId: number) => void;
  isDismissedForModel: (modelId: number) => boolean;
}

export const useModelRiskNoticeStore = create<ModelRiskNoticeStore>()(
  persist(
    (set, get) => ({
      dismissedModelIds: [],
      dismissForModel: (modelId) =>
        set((state) =>
          state.dismissedModelIds.includes(modelId)
            ? state
            : { dismissedModelIds: [...state.dismissedModelIds, modelId] }
        ),
      isDismissedForModel: (modelId) =>
        get().dismissedModelIds.includes(modelId),
    }),
    {
      name: 'model-risk-notices',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ dismissedModelIds: state.dismissedModelIds }),
    }
  )
);
