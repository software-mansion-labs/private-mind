import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Toast from 'react-native-toast-message';
import {
  ChatBranchMarker,
  checkIfChatExists,
  getChatBranchMarkers,
  Message,
} from '../database/chatRepository';
import { useChatStore } from '../store/chatStore';
import { useLLMStore } from '../store/llmStore';
import { CHAT_ENTRY_ANIMATION } from '../constants/chat-route-params';

type UseChatBranchingOptions = {
  chatId: number;
  messageHistoryLength: number;
};

export default function useChatBranching({
  chatId,
  messageHistoryLength,
}: UseChatBranchingOptions) {
  const db = useSQLiteContext();
  const [branchMarkers, setBranchMarkers] = useState<ChatBranchMarker[]>([]);
  const { phantomChat, forkChat, getChatById } = useChatStore();
  const { setActiveChatId } = useLLMStore();

  const isUnpersistedPhantomChat = useCallback(async () => {
    if (phantomChat?.id !== chatId) return false;
    return !(await checkIfChatExists(db, chatId));
  }, [chatId, db, phantomChat?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadBranchMarkers = async () => {
      if (await isUnpersistedPhantomChat()) {
        if (!cancelled) {
          setBranchMarkers([]);
        }
        return;
      }

      try {
        const markers = await getChatBranchMarkers(db, chatId);
        if (!cancelled) {
          setBranchMarkers(markers);
        }
      } catch (error) {
        console.error('Failed to load branch markers:', error);
        if (!cancelled) {
          setBranchMarkers([]);
        }
      }
    };

    loadBranchMarkers();

    return () => {
      cancelled = true;
    };
  }, [chatId, db, isUnpersistedPhantomChat, messageHistoryLength]);

  const handleForkMessage = useCallback(
    async (message: Message) => {
      if (message.role !== 'assistant') return;

      if (await isUnpersistedPhantomChat()) {
        Toast.show({
          type: 'defaultToast',
          text1: 'Send a message before branching this chat.',
        });
        return;
      }

      try {
        const newChatId = await forkChat(chatId, message.id);
        if (!newChatId) return;

        await setActiveChatId(newChatId);
        router.push({
          pathname: `/chat/${newChatId}`,
          params: {
            entryAnimation: CHAT_ENTRY_ANIMATION.BranchCreated,
          },
        });
      } catch (error) {
        console.error('Failed to fork chat:', error);
        Toast.show({
          type: 'defaultToast',
          text1: 'Failed to fork conversation.',
        });
      }
    },
    [chatId, forkChat, isUnpersistedPhantomChat, setActiveChatId]
  );

  const handleBranchMarkerPress = useCallback(
    async (marker: ChatBranchMarker) => {
      if (!getChatById(marker.sourceChatId)) {
        Toast.show({
          type: 'defaultToast',
          text1: 'Source conversation is no longer available.',
        });
        return;
      }

      await setActiveChatId(marker.sourceChatId);
      router.push({ pathname: `/chat/${marker.sourceChatId}` });
    },
    [getChatById, setActiveChatId]
  );

  return {
    branchMarkers,
    handleForkMessage,
    handleBranchMarkerPress,
  };
}
