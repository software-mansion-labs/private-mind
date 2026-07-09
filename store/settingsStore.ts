import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface SettingsStore {
  customSystemPrompt: string;
  setCustomSystemPrompt: (prompt: string) => void;
  hasHydrated: boolean;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      customSystemPrompt: '',
      setCustomSystemPrompt: (customSystemPrompt) =>
        set({ customSystemPrompt }),
      hasHydrated: false,
    }),
    {
      name: 'app-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ customSystemPrompt: state.customSystemPrompt }),
      onRehydrateStorage: () => () => {
        useSettingsStore.setState({ hasHydrated: true });
      },
    }
  )
);
