import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WebSearchProgressEvent } from '../utils/web/runWebSearch';

export type ChallengePolicy = 'ask' | 'reveal' | 'skip';

export const DEFAULT_CHALLENGE_POLICY: ChallengePolicy = 'ask';

export interface WebSearchTraceEntry extends WebSearchProgressEvent {
  id: number;
}

export const WEB_TRACE_MAX = 64;
let nextTraceId = 0;

const isPhaseEvent = (event: WebSearchProgressEvent): boolean =>
  event.type === 'reading' || event.type === 'ranking';

export interface ChallengeHandlers {
  open: () => void;
  cancel: () => void;
}

interface WebSearchStore {
  enabledByChat: Record<number, boolean>;
  isEnabled: (chatId: number | null) => boolean;
  setEnabled: (chatId: number | null, enabled: boolean) => void;
  clearEnabled: (chatId: number | null) => void;
  transfer: (fromChatId: number, toChatId: number) => void;

  isSearchingWeb: boolean;
  webSearchTrace: WebSearchTraceEntry[];
  setSearchingWeb: (searching: boolean) => void;
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
      webSearchTrace: [],
      traceExpanded: false,
      challengeActive: false,
      challengePolicy: DEFAULT_CHALLENGE_POLICY,
      challengeHandlers: null,

      setSearchingWeb: (searching) =>
        set((state) => {
          const isNewSearch = searching && !state.isSearchingWeb;
          return {
            isSearchingWeb: searching,
            webSearchTrace: isNewSearch ? [] : state.webSearchTrace,
            traceExpanded: isNewSearch ? false : state.traceExpanded,
            challengeActive: isNewSearch ? false : state.challengeActive,
          };
        }),

      setTraceExpanded: (expanded) => set({ traceExpanded: expanded }),

      pushWebSearchEvent: (event) => {
        const entry: WebSearchTraceEntry = { ...event, id: nextTraceId++ };
        set((state) => {
          const previous = state.webSearchTrace;
          const last = previous[previous.length - 1];
          const base =
            last && isPhaseEvent(last) && isPhaseEvent(entry)
              ? previous.slice(0, -1)
              : previous;
          const next = [...base, entry];
          return {
            webSearchTrace:
              next.length > WEB_TRACE_MAX ? next.slice(-WEB_TRACE_MAX) : next,
          };
        });
      },

      resetTrace: () =>
        set({
          webSearchTrace: [],
          traceExpanded: false,
          challengeActive: false,
        }),

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

      clearEnabled: (chatId) => {
        if (chatId == null) return;
        set((state) => {
          if (!(chatId in state.enabledByChat)) return state;
          const next = { ...state.enabledByChat };
          delete next[chatId];
          return { enabledByChat: next };
        });
      },

      transfer: (fromChatId, toChatId) => {
        set((state) => {
          const value = state.enabledByChat[fromChatId];
          if (value === undefined) return state;
          const next = { ...state.enabledByChat, [toChatId]: value };
          if (fromChatId !== toChatId) delete next[fromChatId];
          return { enabledByChat: next };
        });
      },
    }),
    {
      name: 'web-search',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ challengePolicy: state.challengePolicy }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<WebSearchStore>;
        const validPolicies: ChallengePolicy[] = ['ask', 'reveal', 'skip'];
        const challengePolicy = validPolicies.includes(saved.challengePolicy!)
          ? saved.challengePolicy!
          : DEFAULT_CHALLENGE_POLICY;
        return { ...current, challengePolicy };
      },
    }
  )
);
