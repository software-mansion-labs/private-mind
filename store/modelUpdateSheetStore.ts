import { create } from 'zustand';

interface ModelUpdateSheetStore {
  newChatEntries: number;
  enterNewChat: () => void;
}

export const useModelUpdateSheetStore = create<ModelUpdateSheetStore>(
  (set) => ({
    newChatEntries: 0,
    enterNewChat: () =>
      set((state) => ({ newChatEntries: state.newChatEntries + 1 })),
  })
);
