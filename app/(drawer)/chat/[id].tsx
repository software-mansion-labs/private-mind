import React, { useCallback } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import ChatScreen from '../../../components/chat-screen/ChatScreen';
import ThinkingGlowHost from '../../../components/chat-screen/ThinkingGlowHost';
import { useState } from 'react';
import { useLLMStore } from '../../../store/llmStore';
import { useModelStore } from '../../../store/modelStore';
import { Model } from '../../../database/modelRepository';
import { useChatStore } from '../../../store/chatStore';
import useChatHeader from '../../../hooks/useChatHeader';
import { useChatBackGuard } from '../../../hooks/useChatBackGuard';
import {
  CHAT_ENTRY_ACTION,
  CHAT_ENTRY_ANIMATION,
  ChatEntryAction,
  ChatEntryAnimation,
} from '../../../constants/chat-route-params';

export default function ChatScreenWrapper() {
  const { id, modelId } = useLocalSearchParams<{
    id: string;
    modelId?: string;
  }>();

  const key = `${id}-${modelId || 'default'}`;

  return (
    <ThinkingGlowHost>
      <ChatScreenInner key={key} />
    </ThinkingGlowHost>
  );
}

function ChatScreenInner() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const {
    modelId,
    entryAnimation,
    entryAction,
  }: {
    modelId: string;
    entryAnimation?: ChatEntryAnimation;
    entryAction?: ChatEntryAction;
  } = useLocalSearchParams();
  const { activeChatMessages, activeChatId } = useLLMStore();
  const { getModelById } = useModelStore();
  const { getChatById, setChatModel, loadChats, phantomChat } = useChatStore();
  const chatId = parseInt(rawId, 10);
  const chat = getChatById(chatId);
  const isPhantom = phantomChat?.id === chatId && !chat;
  const shouldPlayBranchEntryAnimation =
    entryAnimation === CHAT_ENTRY_ANIMATION.BranchCreated;
  const resolvedModelId = chat?.modelId ?? modelId;
  const resolvedModel = resolvedModelId
    ? getModelById(parseInt(resolvedModelId.toString(), 10))
    : undefined;
  const [model, setModel] = useState<Model | undefined>(resolvedModel);
  // Only show the loading/empty state on the very first mount for this
  // chat. useFocusEffect refires on every refocus (including returning
  // from a bottom sheet), and flipping messageHistory to [] mid-session
  // causes Messages.tsx to reset its reveal animation, briefly blanking
  // the chat. If the store already has this chat active, skip the
  // reset and use the existing data. Phantom chats have no history, so
  // skip loading entirely.
  const [isLoading, setIsLoading] = useState(
    !isPhantom && activeChatId !== chatId
  );

  const historyForThisChat =
    activeChatId !== null && activeChatId !== chatId ? [] : activeChatMessages;

  const isEmpty = !isLoading && historyForThisChat.length === 0;
  const shouldExitOnBack = isPhantom && isEmpty;

  const { MenuElements, titleBottom } = useChatHeader({
    chatId: chatId,
    isEmpty,
    hideTitle: isPhantom,
  });

  useFocusEffect(
    useCallback(() => {
      // Read activeChatId via store to avoid re-firing this effect when the
      // store's activeChatId changes while the screen is focused — otherwise
      // clearing activeChatId (e.g. from startPhantomChat during navigation)
      // would retrigger an unwanted re-fetch on the previously-focused chat.
      const currentActiveId = useLLMStore.getState().activeChatId;
      if (currentActiveId === chatId) return;

      const initChat = async () => {
        if (!isPhantom) setIsLoading(true);
        await useLLMStore.getState().setActiveChatId(chatId);
        setIsLoading(false);
      };

      initChat();
    }, [chatId, isPhantom])
  );

  useChatBackGuard(shouldExitOnBack);

  const handleSetModel = async (newModel: Model) => {
    setChatModel(chatId, newModel.id);
    loadChats();
    setModel(newModel);
  };

  return (
    <>
      <ChatScreen
        chatId={chatId}
        chat={chat}
        messageHistory={isLoading ? [] : historyForThisChat}
        isLoading={isLoading}
        model={model}
        selectModel={handleSetModel}
        revealFromTop={shouldPlayBranchEntryAnimation}
        headerTitleBottom={titleBottom}
        opensModelMenu={entryAction === CHAT_ENTRY_ACTION.PickModel}
      />
      {MenuElements}
    </>
  );
}
