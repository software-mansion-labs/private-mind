import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import ChatScreen from '../../../components/chat-screen/ChatScreen';
import useDefaultHeader from '../../../hooks/useDefaultHeader';
import { useEffect, useState } from 'react';
import { useLLMStore } from '../../../store/llmStore';
import useChatHeader from '../../../hooks/useChatHeader';
import { useModelStore } from '../../../store/modelStore';
import { Model } from '../../../database/modelRepository';
import { useChatStore } from '../../../store/chatStore';

export default function ChatScreenWrapper() {
  useDefaultHeader();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const { modelId }: { modelId: string } = useLocalSearchParams();

  const { activeChatMessages, setActiveChatId } = useLLMStore();
  const { getModelById } = useModelStore();
  const { getChatById, setChatModel, loadChats } = useChatStore();

  const chatId = parseInt(rawId);
  const chat = getChatById(chatId);
  const resolvedModelId = modelId ?? chat?.modelId;
  const chatModel = resolvedModelId
    ? getModelById(parseInt(resolvedModelId.toString()))
    : undefined;

  const [model, setModel] = useState<Model | undefined>(chatModel);
  const [isLoading, setIsLoading] = useState(true);

  useChatHeader({
    chatId: chatId,
    chatModel: model,
  });

  useEffect(() => {
    (async () => {
      await setActiveChatId(chatId);
      setIsLoading(false);
    })();
  }, [chatId]);

  const handleSetModel = async (model: Model) => {
    setChatModel(chatId, model.id);
    loadChats();
    setModel(model);
  };

  return (
    <ChatScreen
      chatId={chatId}
      messageHistory={isLoading ? [] : activeChatMessages}
      model={model}
      selectModel={handleSetModel}
    />
  );
}
