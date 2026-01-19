import React, { useCallback, useEffect } from 'react';
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
  const { activeChatMessages, setActiveChatId } = useLLMStore();
  const { getModelById } = useModelStore();
  const { getChatById, setChatModel, loadChats } = useChatStore();
  const chatId = parseInt(rawId);
  const chat = getChatById(chatId);

  const resolvedModelId = modelId ?? chat?.modelId;
  const resolvedModel = resolvedModelId
    ? getModelById(parseInt(resolvedModelId.toString()))
    : undefined;
  const [model, setModel] = useState<Model | undefined>(resolvedModel);
  const [isLoading, setIsLoading] = useState(true);

  useChatHeader({
    chatId: chatId,
    chatModel: model,
  });

  useFocusEffect(
    useCallback(() => {
      const initChat = async () => {
        setIsLoading(true);
        await setActiveChatId(chatId);
        setIsLoading(false);
      };

      initChat();
    }, [chatId])
  );

  const handleSetModel = async (model: Model) => {
    setChatModel(chatId, model.id);
    loadChats();
    setModel(model);
  };

  return (
    <ChatScreen
      chatId={chatId}
      chat={chat}
      messageHistory={isLoading ? [] : activeChatMessages}
      isLoading={isLoading}
      model={model}
      selectModel={handleSetModel}
    />
  );
}
