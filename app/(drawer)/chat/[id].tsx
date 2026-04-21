import React, { useCallback, useRef } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import ChatScreen from '../../../components/chat-screen/ChatScreen';
import { useState } from 'react';
import { useLLMStore } from '../../../store/llmStore';
import { useModelStore } from '../../../store/modelStore';
import { Model } from '../../../database/modelRepository';
import { useChatStore } from '../../../store/chatStore';
import useChatHeader from '../../../hooks/useChatHeader';

export default function ChatScreenWrapper() {
  const { id, modelId } = useLocalSearchParams<{
    id: string;
    modelId?: string;
  }>();

  const key = `${id}-${modelId || 'default'}`;

  return <ChatScreenInner key={key} />;
}

function ChatScreenInner() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const { modelId }: { modelId: string } = useLocalSearchParams();
  const { activeChatMessages, activeChatId, setActiveChatId } = useLLMStore();
  const { getModelById } = useModelStore();
  const { getChatById, setChatModel, loadChats, phantomChat } = useChatStore();
  const chatId = parseInt(rawId);
  const chat = getChatById(chatId);
  const isPhantom = phantomChat?.id === chatId;
  const resolvedModelId = modelId ?? chat?.modelId;
  const resolvedModel = resolvedModelId
    ? getModelById(parseInt(resolvedModelId.toString()))
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

  const isEmpty = !isLoading && activeChatMessages.length === 0;
  const openModelSheetRef = useRef<(() => void) | null>(null);

  const { MenuElements } = useChatHeader({
    chatId: chatId,
    chatModel: model,
    isEmpty,
    onSelectModelFromTitle: isPhantom
      ? () => openModelSheetRef.current?.()
      : undefined,
  });

  useFocusEffect(
    useCallback(() => {
      // Read activeChatId via store to avoid re-firing this effect when the
      // store's activeChatId changes while the screen is focused — otherwise
      // clearing activeChatId (e.g. from startPhantomChat during navigation)
      // would retrigger an unwanted re-fetch on the previously-focused chat.
      const currentActiveId = useLLMStore.getState().activeChatId;
      if (currentActiveId === chatId) {
        return;
      }
      const initChat = async () => {
        if (!isPhantom) setIsLoading(true);
        await setActiveChatId(chatId);
        setIsLoading(false);
      };

      initChat();
    }, [chatId, isPhantom])
  );

  const handleSetModel = async (model: Model) => {
    setChatModel(chatId, model.id);
    loadChats();
    setModel(model);
  };

  return (
    <>
      <ChatScreen
        chatId={chatId}
        chat={chat}
        messageHistory={isLoading ? [] : activeChatMessages}
        isLoading={isLoading}
        model={model}
        selectModel={handleSetModel}
        openModelSheetRef={openModelSheetRef}
      />
      {MenuElements}
    </>
  );
}
