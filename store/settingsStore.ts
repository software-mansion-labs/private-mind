import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Settings } from 'react-native-pulsar';
import { MAX_CUSTOM_SYSTEM_PROMPT_LENGTH } from '../constants/settings';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface SettingsStore {
  customSystemPrompt: string;
  setCustomSystemPrompt: (prompt: string) => void;
  showPerformanceMetrics: boolean;
  setShowPerformanceMetrics: (show: boolean) => void;
  dismissedWhatsNewVersion: string | null;
  dismissWhatsNew: (version: string) => void;
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => void;
  hasHydrated: boolean;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      customSystemPrompt: '',
      setCustomSystemPrompt: (customSystemPrompt) =>
        set({
          customSystemPrompt: customSystemPrompt
            .trim()
            .slice(0, MAX_CUSTOM_SYSTEM_PROMPT_LENGTH),
        }),
      showPerformanceMetrics: false,
      setShowPerformanceMetrics: (showPerformanceMetrics) =>
        set({ showPerformanceMetrics }),
      dismissedWhatsNewVersion: null,
      dismissWhatsNew: (dismissedWhatsNewVersion) =>
        set({ dismissedWhatsNewVersion }),
      themePreference: 'system',
      setThemePreference: (themePreference) => set({ themePreference }),
      hapticsEnabled: true,
      setHapticsEnabled: (hapticsEnabled) => {
        Settings.enableHaptics(hapticsEnabled);
        set({ hapticsEnabled });
      },
      hasHydrated: false,
    }),
    {
      name: 'app-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        customSystemPrompt: state.customSystemPrompt,
        showPerformanceMetrics: state.showPerformanceMetrics,
        dismissedWhatsNewVersion: state.dismissedWhatsNewVersion,
        themePreference: state.themePreference,
        hapticsEnabled: state.hapticsEnabled,
      }),
      onRehydrateStorage: () => (state) => {
        Settings.enableHaptics(state?.hapticsEnabled ?? true);
        useSettingsStore.setState({ hasHydrated: true });
      },
    }
  )
);
