import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface SettingsStore {
  customSystemPrompt: string;
  setCustomSystemPrompt: (prompt: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      customSystemPrompt: '',
      setCustomSystemPrompt: (customSystemPrompt) =>
        set({ customSystemPrompt }),
    }),
    {
      name: 'app-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
