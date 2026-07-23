import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WebSearchProgressEvent } from '../utils/web/runWebSearch';

export type ChallengePolicy = 'ask' | 'reveal' | 'skip';

export const DEFAULT_CHALLENGE_POLICY: ChallengePolicy = 'ask';

export interface WebSearchTraceEntry extends WebSearchProgressEvent {
  id: number;
}

export const WEB_TRACE_MAX = 24;
let nextTraceId = 0;

export interface ChallengeHandlers {
  open: () => void;
  cancel: () => void;
}

interface WebSearchStore {
  enabledByChat: Record<number, boolean>;
  isEnabled: (chatId: number | null) => boolean;
  setEnabled: (chatId: number | null, enabled: boolean) => void;
  transfer: (fromChatId: number, toChatId: number) => void;

  isSearchingWeb: boolean;
  webSearchQuery: string | null;
  webSearchTrace: WebSearchTraceEntry[];
  setSearchingWeb: (searching: boolean, query?: string | null) => void;
  pushWebSearchEvent: (event: WebSearchProgressEvent) => void;
  resetTrace: () => void;

  traceExpanded: boolean;
  setTraceExpanded: (expanded: boolean) => void;

  challengeActive: boolean;
  setChallengeActive: (active: boolean) => void;

  challengePolicy: ChallengePolicy;
  updateChallengePolicy: (policy: ChallengePolicy) => void;

  challengeHandlers: ChallengeHandlers | null;
  registerChallengeHandlers: (handlers: ChallengeHandlers | null) => void;
  openChallenge: () => void;
  cancelChallenge: () => void;
}

export const useWebSearchStore = create<WebSearchStore>()(
  persist(
    (set, get) => ({
      enabledByChat: {},
      isSearchingWeb: false,
      webSearchQuery: null,
      webSearchTrace: [],
      traceExpanded: false,
      challengeActive: false,
      challengePolicy: DEFAULT_CHALLENGE_POLICY,
      challengeHandlers: null,

      setSearchingWeb: (searching, query = null) =>
        set((state) => {
          const isNewSearch = searching && !state.isSearchingWeb;
          return {
            isSearchingWeb: searching,
            webSearchQuery: searching ? query : null,
            webSearchTrace: isNewSearch ? [] : state.webSearchTrace,
            traceExpanded: isNewSearch ? false : state.traceExpanded,
          };
        }),

      setTraceExpanded: (expanded) => set({ traceExpanded: expanded }),

      pushWebSearchEvent: (event) => {
        const entry: WebSearchTraceEntry = { ...event, id: nextTraceId++ };
        set((state) => {
          const next = [...state.webSearchTrace, entry];
          return {
            webSearchTrace:
              next.length > WEB_TRACE_MAX ? next.slice(-WEB_TRACE_MAX) : next,
          };
        });
      },

      resetTrace: () => set({ webSearchTrace: [], traceExpanded: false }),

      setChallengeActive: (active) => set({ challengeActive: active }),

      updateChallengePolicy: (policy) => set({ challengePolicy: policy }),

      registerChallengeHandlers: (handlers) =>
        set({ challengeHandlers: handlers }),

      openChallenge: () => get().challengeHandlers?.open(),

      cancelChallenge: () => {
        set({ challengeActive: false });
        get().challengeHandlers?.cancel();
      },

      isEnabled: (chatId) =>
        chatId == null ? false : (get().enabledByChat[chatId] ?? false),

      setEnabled: (chatId, enabled) => {
        if (chatId == null) return;
        set((state) => ({
          enabledByChat: { ...state.enabledByChat, [chatId]: enabled },
        }));
      },

      transfer: (fromChatId, toChatId) => {
        set((state) => {
          const value = state.enabledByChat[fromChatId];
          if (value === undefined) return state;
          return {
            enabledByChat: { ...state.enabledByChat, [toChatId]: value },
          };
        });
      },
    }),
    {
      name: 'web-search',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ challengePolicy: state.challengePolicy }),
    }
  )
);
