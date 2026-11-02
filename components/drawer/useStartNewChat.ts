import { useSQLiteContext } from 'expo-sqlite';
import { useLLMStore } from '../../store/llmStore';
import { startPhantomChat } from '../../utils/startPhantomChat';
import { Feedback } from '../../utils/Feedback';
import { useTurnInFlight } from '../../hooks/useTurnInFlight';
import { showTurnInFlightNotice } from '../../utils/turnInFlightNotice';
import { useIsOnPhantomChat } from './useIsOnPhantomChat';

export const useStartNewChat = (onNavigate?: () => void) => {
  const db = useSQLiteContext();
  const interrupt = useLLMStore((state) => state.interrupt);

  const isOnPhantomChat = useIsOnPhantomChat();
  const turnInFlight = useTurnInFlight();

  const startNewChat = () => {
    if (turnInFlight) {
      showTurnInFlightNotice();
      return;
    }
    Feedback.newChat();
    if (isOnPhantomChat) {
      onNavigate?.();
      return;
    }
    interrupt();
    startPhantomChat(db, 'replace');
    onNavigate?.();
  };

  return { startNewChat, turnInFlight };
};
